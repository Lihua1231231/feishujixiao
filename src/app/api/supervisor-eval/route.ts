import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, getActiveCycle } from "@/lib/session";
import { sanitizeText, validateStars } from "@/lib/validate";
import { buildSupervisorAssignmentMap, isEvalListUser } from "@/lib/supervisor-assignments";

function computeWeightedScore(performanceStars: number | null, abilityStars: number | null, valuesStars: number | null): number | null {
  if (performanceStars == null || abilityStars == null || valuesStars == null) return null;
  return performanceStars * 0.5 + abilityStars * 0.3 + valuesStars * 0.2;
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["SUPERVISOR", "HRBP", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const cycle = await prisma.reviewCycle.findFirst({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
    });
    if (!cycle) return NextResponse.json([]);

    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        department: true,
        jobTitle: true,
        supervisorId: true,
        supervisor: { select: { id: true, name: true } },
      },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    });

    const allSupervisorEvals = await prisma.supervisorEval.findMany({
      where: { cycleId: cycle.id },
      include: {
        evaluator: { select: { id: true, name: true } },
      },
    });

    const assignments = buildSupervisorAssignmentMap(
      allUsers.map((item) => ({
        id: item.id,
        name: item.name,
        supervisorId: item.supervisorId,
        supervisor: item.supervisor,
      })),
      allSupervisorEvals.map((item) => ({
        employeeId: item.employeeId,
        evaluatorId: item.evaluatorId,
        evaluatorName: item.evaluator.name,
      }))
    );

    const usersById = new Map(allUsers.map((item) => [item.id, item]));
    const evalsByEmployeeId = new Map<string, typeof allSupervisorEvals>();
    for (const evalItem of allSupervisorEvals) {
      const list = evalsByEmployeeId.get(evalItem.employeeId) || [];
      list.push(evalItem);
      evalsByEmployeeId.set(evalItem.employeeId, list);
    }

    const relevantEmployeeIds = [...assignments.values()]
      .filter((assignment) => assignment.currentEvaluatorIds.includes(user.id) || assignment.legacyEvaluatorIds.includes(user.id))
      .map((assignment) => assignment.employeeId);

    if (relevantEmployeeIds.length === 0) {
      return NextResponse.json([]);
    }

    const [selfEvals, peerReviews, acceptedNominations] = await Promise.all([
      prisma.selfEvaluation.findMany({
        where: { cycleId: cycle.id, userId: { in: relevantEmployeeIds } },
      }),
      prisma.peerReview.findMany({
        where: { cycleId: cycle.id, revieweeId: { in: relevantEmployeeIds }, status: "SUBMITTED" },
        select: {
          revieweeId: true,
          outputScore: true, outputComment: true,
          collaborationScore: true, collaborationComment: true,
          valuesScore: true, valuesComment: true,
          innovationScore: true, innovationComment: true,
        },
      }),
      prisma.reviewerNomination.findMany({
        where: { cycleId: cycle.id, nominatorId: { in: relevantEmployeeIds }, nomineeStatus: "ACCEPTED" },
        select: { nominatorId: true },
      }),
    ]);

    const selfEvalByUserId = new Map(selfEvals.map((item) => [item.userId, item]));
    const peerReviewsByEmployeeId = new Map<string, typeof peerReviews>();
    for (const review of peerReviews) {
      const list = peerReviewsByEmployeeId.get(review.revieweeId) || [];
      list.push(review);
      peerReviewsByEmployeeId.set(review.revieweeId, list);
    }
    const expectedCountByEmployeeId = new Map<string, number>();
    for (const nomination of acceptedNominations) {
      expectedCountByEmployeeId.set(
        nomination.nominatorId,
        (expectedCountByEmployeeId.get(nomination.nominatorId) || 0) + 1
      );
    }

    const result = relevantEmployeeIds
      .map((employeeId) => {
        const employee = usersById.get(employeeId);
        const assignment = assignments.get(employeeId);
        if (!employee || !assignment) return null;

        const employeeEvals = evalsByEmployeeId.get(employeeId) || [];
        const myEval = employeeEvals.find((item) => item.evaluatorId === user.id) || null;
        const reviews = peerReviewsByEmployeeId.get(employeeId) || [];
        const isLegacyRecord = !assignment.currentEvaluatorIds.includes(user.id) && Boolean(myEval);

        const avgPeer = {
          output: reviews.length > 0 ? reviews.reduce((sum, review) => sum + (review.outputScore || 0), 0) / reviews.length : 0,
          collaboration: reviews.length > 0 ? reviews.reduce((sum, review) => sum + (review.collaborationScore || 0), 0) / reviews.length : 0,
          values: reviews.length > 0 ? reviews.reduce((sum, review) => sum + (review.valuesScore || 0), 0) / reviews.length : 0,
          count: reviews.length,
          expectedCount: expectedCountByEmployeeId.get(employeeId) || 0,
          reviews,
        };

        return {
          employee: {
            id: employee.id,
            name: employee.name,
            department: employee.department,
            jobTitle: employee.jobTitle,
          },
          evaluation: myEval,
          selfEval: selfEvalByUserId.get(employeeId)
            ? {
                status: selfEvalByUserId.get(employeeId)!.status,
                importedContent: selfEvalByUserId.get(employeeId)!.importedContent,
                sourceUrl: selfEvalByUserId.get(employeeId)!.sourceUrl || undefined,
              }
            : null,
          peerReviewSummary: avgPeer,
          isLegacyRecord,
          expectedEvaluatorNames: assignment.currentEvaluatorNames,
          currentEvaluatorNames: assignment.currentEvaluatorNames,
          legacyOwnerNames: assignment.legacyEvaluatorNames,
          allSupervisorEvals: employeeEvals.map((item) => ({
            evaluatorId: item.evaluatorId,
            evaluatorName: item.evaluator.name,
            status: item.status,
            weightedScore: item.weightedScore != null ? Number(item.weightedScore) : null,
            isCurrentAssignment: assignment.currentEvaluatorIds.includes(item.evaluatorId),
          })),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.employee.department.localeCompare(b.employee.department) || a.employee.name.localeCompare(b.employee.name));

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["SUPERVISOR", "HRBP", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const cycle = await getActiveCycle();
    if (!cycle) {
      return NextResponse.json({ error: "No active cycle" }, { status: 400 });
    }

    if (user.role !== "ADMIN" && cycle.status !== "SUPERVISOR_EVAL") {
      return NextResponse.json({ error: "当前不在上级评估阶段，无法执行此操作" }, { status: 400 });
    }

    const employee = await prisma.user.findUnique({
      where: { id: body.employeeId },
      select: {
        id: true,
        name: true,
        supervisorId: true,
        supervisor: { select: { id: true, name: true } },
      },
    });
    if (!employee || !isEvalListUser(employee.name)) {
      return NextResponse.json({ error: "员工不在考核名单中" }, { status: 404 });
    }

    const [allUsers, employeeEvals] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          supervisorId: true,
          supervisor: { select: { id: true, name: true } },
        },
      }),
      prisma.supervisorEval.findMany({
        where: { cycleId: cycle.id, employeeId: body.employeeId },
        include: {
          evaluator: { select: { id: true, name: true } },
        },
      }),
    ]);

    const assignment = buildSupervisorAssignmentMap(
      allUsers,
      employeeEvals.map((item) => ({
        employeeId: item.employeeId,
        evaluatorId: item.evaluatorId,
        evaluatorName: item.evaluator.name,
      }))
    ).get(body.employeeId);

    if (!assignment) {
      return NextResponse.json({ error: "未找到初评关系" }, { status: 404 });
    }

    const myExistingEval = employeeEvals.find((item) => item.evaluatorId === user.id) || null;
    const isCurrentAssignment = assignment.currentEvaluatorIds.includes(user.id);

    if (!isCurrentAssignment && !myExistingEval) {
      return NextResponse.json({ error: "你不是该员工当前有效初评人，也没有历史保留记录" }, { status: 403 });
    }

    if (myExistingEval?.status === "SUBMITTED") {
      return NextResponse.json({ error: "已提交，无法修改" }, { status: 400 });
    }

    const isSubmit = body.action === "submit";

    const performanceStars = validateStars(body.performanceStars);
    const comprehensiveStars = validateStars(body.comprehensiveStars);
    const learningStars = validateStars(body.learningStars);
    const adaptabilityStars = validateStars(body.adaptabilityStars);
    const abilityStars = (comprehensiveStars != null && learningStars != null && adaptabilityStars != null)
      ? Math.round((comprehensiveStars + learningStars + adaptabilityStars) / 3)
      : null;
    const candidStars = validateStars(body.candidStars);
    const progressStars = validateStars(body.progressStars);
    const altruismStars = validateStars(body.altruismStars);
    const rootStars = validateStars(body.rootStars);
    const valuesStars = (candidStars != null && progressStars != null && altruismStars != null && rootStars != null)
      ? Math.round((candidStars + progressStars + altruismStars + rootStars) / 4)
      : null;
    const weightedScore = computeWeightedScore(performanceStars, abilityStars, valuesStars);

    if (isSubmit) {
      if (!performanceStars || !comprehensiveStars || !learningStars || !adaptabilityStars || !candidStars || !progressStars || !altruismStars || !rootStars) {
        return NextResponse.json({ error: "请完成所有维度的星级评分" }, { status: 400 });
      }
      const pc = sanitizeText(body.performanceComment);
      const ac = sanitizeText(body.abilityComment);
      const cc = sanitizeText(body.candidComment);
      const prc = sanitizeText(body.progressComment);
      const alc = sanitizeText(body.altruismComment);
      const rc = sanitizeText(body.rootComment);
      if (!pc || !ac || !cc || !prc || !alc || !rc) {
        return NextResponse.json({ error: "请填写所有维度的文字评语" }, { status: 400 });
      }
    }

    const payload = {
      performanceStars,
      performanceComment: sanitizeText(body.performanceComment),
      abilityStars,
      abilityComment: sanitizeText(body.abilityComment),
      comprehensiveStars,
      learningStars,
      adaptabilityStars,
      valuesStars,
      valuesComment: sanitizeText(body.valuesComment),
      candidStars,
      candidComment: sanitizeText(body.candidComment),
      progressStars,
      progressComment: sanitizeText(body.progressComment),
      altruismStars,
      altruismComment: sanitizeText(body.altruismComment),
      rootStars,
      rootComment: sanitizeText(body.rootComment),
      weightedScore,
      status: isSubmit ? "SUBMITTED" : "DRAFT",
      submittedAt: isSubmit ? new Date() : undefined,
    };

    const evalResult = myExistingEval
      ? await prisma.supervisorEval.update({
          where: { id: myExistingEval.id },
          data: payload,
        })
      : await prisma.supervisorEval.create({
          data: {
            cycleId: cycle.id,
            evaluatorId: user.id,
            employeeId: body.employeeId,
            ...payload,
            submittedAt: isSubmit ? new Date() : null,
          },
        });

    return NextResponse.json(evalResult);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
