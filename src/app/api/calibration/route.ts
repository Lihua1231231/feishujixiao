import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, getActiveCycle } from "@/lib/session";
import { validateStars } from "@/lib/validate";
import { buildSupervisorAssignmentMap } from "@/lib/supervisor-assignments";
import { computePeerReviewAverageFromReviews } from "@/lib/peer-review-summary";

// Get all calibration data
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["HRBP", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const cycle = await prisma.reviewCycle.findFirst({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
    });
    if (!cycle) return NextResponse.json([]);

    const users = await prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      select: {
        id: true,
        name: true,
        department: true,
        jobTitle: true,
        role: true,
        supervisorId: true,
        supervisor: { select: { id: true, name: true } },
      },
    });

    const allSupervisorEvals = await prisma.supervisorEval.findMany({
      where: { cycleId: cycle.id },
      include: {
        evaluator: { select: { id: true, name: true } },
      },
    });

    const assignments = buildSupervisorAssignmentMap(
      users.map((item) => ({
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

    const supervisorEvalsByEmployeeId = new Map<string, typeof allSupervisorEvals>();
    for (const evalItem of allSupervisorEvals) {
      const list = supervisorEvalsByEmployeeId.get(evalItem.employeeId) || [];
      list.push(evalItem);
      supervisorEvalsByEmployeeId.set(evalItem.employeeId, list);
    }

    const data = await Promise.all(
      users.map(async (u) => {
        const selfEval = await prisma.selfEvaluation.findUnique({
          where: { cycleId_userId: { cycleId: cycle.id, userId: u.id } },
          select: { importedAt: true },
        });

        const calibration = await prisma.calibrationResult.findUnique({
          where: { cycleId_userId: { cycleId: cycle.id, userId: u.id } },
        });

        const peerReviews = await prisma.peerReview.findMany({
          where: { cycleId: cycle.id, revieweeId: u.id, status: "SUBMITTED" },
        });

        const peerAverage = computePeerReviewAverageFromReviews(peerReviews);
        const peerAvg = peerAverage != null ? peerAverage.toFixed(1) : null;
        const assignment = assignments.get(u.id);
        const supervisorEvals = (supervisorEvalsByEmployeeId.get(u.id) || []).map((item) => ({
          evaluatorName: item.evaluator.name,
          status: item.status,
          weightedScore: item.weightedScore != null ? Number(item.weightedScore) : null,
          isCurrentAssignment: assignment?.currentEvaluatorIds.includes(item.evaluatorId) ?? false,
        }));
        const proposedStars = calibration?.proposedStars != null ? Math.round(calibration.proposedStars) : null;

        return {
          user: u,
          selfEvalStatus: selfEval?.importedAt ? "imported" : "not_imported",
          peerAvg,
          supervisorWeighted: null,
          supervisorEvals,
          proposedStars,
          finalStars: calibration?.finalStars ?? null,
        };
      })
    );

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// Update calibration result
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["HRBP", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json();

    const finalStars = validateStars(body.finalStars);
    if (finalStars === null) {
      return NextResponse.json({ error: "finalStars must be an integer between 1 and 5" }, { status: 400 });
    }

    const cycle = await getActiveCycle();
    if (!cycle) {
      return NextResponse.json({ error: "No active cycle" }, { status: 400 });
    }

    // 周期阶段验证（ADMIN豁免）
    if (user.role !== "ADMIN" && cycle.status !== "CALIBRATION") {
      return NextResponse.json({ error: "当前不在校准阶段，无法执行此操作" }, { status: 400 });
    }

    const result = await prisma.calibrationResult.upsert({
      where: {
        cycleId_userId: { cycleId: cycle.id, userId: body.userId },
      },
      update: {
        finalStars,
        adjustedBy: user.name,
        adjustReason: body.adjustReason || "",
      },
      create: {
        cycleId: cycle.id,
        userId: body.userId,
        finalStars,
        adjustedBy: user.name,
        adjustReason: body.adjustReason || "",
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
