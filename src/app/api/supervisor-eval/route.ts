import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, getActiveCycle } from "@/lib/session";
import { sanitizeText, validateStars } from "@/lib/validate";
import { buildSupervisorAssignmentMap, isEvalListUser } from "@/lib/supervisor-assignments";
import {
  buildPeerReviewCategorySummary,
  getPeerReviewAbilityAverage,
  getPeerReviewPerformanceAverage,
  getPeerReviewValuesAverage,
} from "@/lib/peer-review-summary";
import {
  computeRoundedAbilityStars,
  computeRoundedValuesStars,
  computeWeightedScoreFromDimensions,
} from "@/lib/weighted-score";
import {
  hasPendingImportedSupervisorEvalComments,
  isScreenshotImportedComment,
} from "@/lib/supervisor-eval-import";

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
    const canEdit = true;
    const lockedReason = null;

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
      return NextResponse.json({
        cycleStatus: cycle.status,
        canEdit,
        lockedReason,
        items: [],
      });
    }

    const [selfEvals, peerReviews, acceptedNominations] = await Promise.all([
      prisma.selfEvaluation.findMany({
        where: { cycleId: cycle.id, userId: { in: relevantEmployeeIds } },
      }),
      prisma.peerReview.findMany({
        where: { cycleId: cycle.id, revieweeId: { in: relevantEmployeeIds }, status: "SUBMITTED" },
        select: {
          revieweeId: true,
          outputScore: true,
          outputComment: true,
          collaborationScore: true,
          collaborationComment: true,
          valuesScore: true,
          valuesComment: true,
          innovationScore: true,
          innovationComment: true,
          performanceStars: true,
          performanceComment: true,
          comprehensiveStars: true,
          comprehensiveComment: true,
          learningStars: true,
          learningComment: true,
          adaptabilityStars: true,
          adaptabilityComment: true,
          candidStars: true,
          candidComment: true,
          progressStars: true,
          progressComment: true,
          altruismStars: true,
          altruismComment: true,
          rootStars: true,
          rootComment: true,
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

        const categorySummary = buildPeerReviewCategorySummary(reviews);
        const avgPeer = {
          performance: categorySummary.performance ?? 0,
          ability: categorySummary.ability ?? 0,
          values: categorySummary.values ?? 0,
          overall: categorySummary.overall ?? 0,
          count: reviews.length,
          expectedCount: expectedCountByEmployeeId.get(employeeId) || 0,
          reviews: reviews.map((review) => ({
            performanceStars: getPeerReviewPerformanceAverage(review),
            performanceComment: review.performanceComment || review.outputComment || "",
            abilityAverage: getPeerReviewAbilityAverage(review),
            comprehensiveStars: review.comprehensiveStars ?? null,
            comprehensiveComment: review.comprehensiveComment || "",
            learningStars: review.learningStars ?? null,
            learningComment: review.learningComment || "",
            adaptabilityStars: review.adaptabilityStars ?? null,
            adaptabilityComment: review.adaptabilityComment || "",
            legacyCollaborationScore: review.collaborationScore ?? null,
            legacyCollaborationComment: review.collaborationComment || "",
            valuesAverage: getPeerReviewValuesAverage(review),
            candidStars: review.candidStars ?? null,
            candidComment: review.candidComment || "",
            progressStars: review.progressStars ?? null,
            progressComment: review.progressComment || "",
            altruismStars: review.altruismStars ?? null,
            altruismComment: review.altruismComment || "",
            rootStars: review.rootStars ?? null,
            rootComment: review.rootComment || "",
            legacyValuesScore: review.valuesScore ?? null,
            legacyValuesComment: review.valuesComment || "",
            innovationScore: review.innovationScore ?? null,
            innovationComment: review.innovationComment || "",
          })),
        };

        const canEditSubmitted =
          user.name === "张东杰"
          && myEval?.status === "SUBMITTED"
          && hasPendingImportedSupervisorEvalComments(myEval);

        return {
          employee: {
            id: employee.id,
            name: employee.name,
            department: employee.department,
            jobTitle: employee.jobTitle,
          },
          evaluation: myEval
            ? {
                ...myEval,
                canEditSubmitted,
              }
            : null,
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

    return NextResponse.json({
      cycleStatus: cycle.status,
      canEdit,
      lockedReason,
      items: result,
    });
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

    const canEditImportedSubmission =
      user.name === "张东杰"
      && myExistingEval?.status === "SUBMITTED"
      && hasPendingImportedSupervisorEvalComments(myExistingEval);

    if (myExistingEval?.status === "SUBMITTED" && !canEditImportedSubmission) {
      return NextResponse.json({ error: "已提交，无法修改" }, { status: 400 });
    }

    const isSubmit = body.action === "submit";

    const performanceStars = validateStars(body.performanceStars);
    const comprehensiveStars = validateStars(body.comprehensiveStars);
    const learningStars = validateStars(body.learningStars);
    const adaptabilityStars = validateStars(body.adaptabilityStars);
    const abilityStars = computeRoundedAbilityStars(comprehensiveStars, learningStars, adaptabilityStars);
    const candidStars = validateStars(body.candidStars);
    const progressStars = validateStars(body.progressStars);
    const altruismStars = validateStars(body.altruismStars);
    const rootStars = validateStars(body.rootStars);
    const valuesStars = computeRoundedValuesStars(candidStars, progressStars, altruismStars, rootStars);
    const weightedScore = computeWeightedScoreFromDimensions({
      performanceStars,
      comprehensiveStars,
      learningStars,
      adaptabilityStars,
      candidStars,
      progressStars,
      altruismStars,
      rootStars,
    });

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
      if (
        canEditImportedSubmission
        && [pc, ac, cc, prc, alc, rc].some((comment) => isScreenshotImportedComment(comment))
      ) {
        return NextResponse.json({ error: "请先把导入占位评语补成真实内容，再重新提交" }, { status: 400 });
      }
    }

    const preserveSubmittedStatus = Boolean(canEditImportedSubmission && myExistingEval);

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
      status: preserveSubmittedStatus ? "SUBMITTED" : isSubmit ? "SUBMITTED" : "DRAFT",
      submittedAt: preserveSubmittedStatus || isSubmit ? new Date() : undefined,
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
