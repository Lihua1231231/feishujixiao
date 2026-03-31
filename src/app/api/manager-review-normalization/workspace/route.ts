import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCycle, getSessionUser } from "@/lib/session";
import { canAccessScoreNormalization } from "@/lib/score-normalization-permissions";
import { computeWeightedScoreFromDimensions, roundToOneDecimal } from "@/lib/weighted-score";
import {
  buildManagerReviewApplicationRecord,
  buildManagerReviewWorkspacePayload,
  type ManagerReviewRaterRecord,
  type ManagerReviewSubjectRecord,
} from "@/lib/manager-review-normalization";

function average(values: Array<number | null | undefined>) {
  const filtered = values.filter((value): value is number => value != null && !Number.isNaN(value));
  if (filtered.length === 0) return null;
  return roundToOneDecimal(filtered.reduce((sum, value) => sum + value, 0) / filtered.length);
}

function sortBySubjectName(left: Pick<ManagerReviewSubjectRecord, "subjectName" | "subjectId">, right: Pick<ManagerReviewSubjectRecord, "subjectName" | "subjectId">) {
  return (left.subjectName ?? left.subjectId).localeCompare(right.subjectName ?? right.subjectId, "zh-Hans-CN");
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function loadManagerReviewWorkspaceRecords(cycleId: string) {
  const evals = await prisma.supervisorEval.findMany({
    where: { cycleId, status: "SUBMITTED" },
    select: {
      id: true,
      evaluatorId: true,
      evaluator: { select: { name: true, department: true } },
      employeeId: true,
      employee: { select: { name: true, department: true } },
      weightedScore: true,
      performanceStars: true,
      comprehensiveStars: true,
      learningStars: true,
      adaptabilityStars: true,
      valuesStars: true,
      candidStars: true,
      progressStars: true,
      altruismStars: true,
      rootStars: true,
    },
  });

  const raterRecords: ManagerReviewRaterRecord[] = evals.map((item) => ({
    sourceRecordId: item.id,
    subjectId: item.employeeId,
    subjectName: item.employee.name ?? null,
    subjectDepartment: item.employee.department ?? null,
    score: item.weightedScore ?? computeWeightedScoreFromDimensions({
      performanceStars: item.performanceStars,
      comprehensiveStars: item.comprehensiveStars,
      learningStars: item.learningStars,
      adaptabilityStars: item.adaptabilityStars,
      candidStars: item.candidStars,
      progressStars: item.progressStars,
      altruismStars: item.altruismStars,
      rootStars: item.rootStars,
    }),
    raterId: item.evaluatorId,
    raterName: item.evaluator.name ?? null,
    raterDepartment: item.evaluator.department ?? null,
  }));

  const grouped = new Map<string, typeof raterRecords>();
  for (const record of raterRecords) {
    const list = grouped.get(record.subjectId) ?? [];
    list.push(record);
    grouped.set(record.subjectId, list);
  }

  const subjectRecords: ManagerReviewSubjectRecord[] = [...grouped.entries()]
    .map(([employeeId, list]) => ({
      sourceRecordId: employeeId,
      subjectId: employeeId,
      subjectName: list[0]?.subjectName ?? null,
      subjectDepartment: list[0]?.subjectDepartment ?? null,
      score: average(list.map((entry) => entry.score)),
    }))
    .sort(sortBySubjectName);

  return { subjectRecords, raterRecords };
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("未登录", 401);
    }
    if (!canAccessScoreNormalization(user)) {
      return jsonError("无权查看分布校准", 403);
    }

    const cycle = await getActiveCycle();
    if (!cycle) {
      return jsonError("当前无活动周期", 404);
    }

    const workspaceRecords = await loadManagerReviewWorkspaceRecords(cycle.id);
    const activeApplication = await prisma.managerReviewNormalizationApplication.findUnique({
      where: { cycleId_source: { cycleId: cycle.id, source: "SUPERVISOR_EVAL" } },
      select: {
        cycleId: true,
        source: true,
        snapshotId: true,
        appliedAt: true,
        revertedAt: true,
        snapshot: { select: { targetBucketCount: true } },
      },
    });

    const application = activeApplication
      ? buildManagerReviewApplicationRecord({
          cycleId: activeApplication.cycleId,
          source: "SUPERVISOR_EVAL",
          snapshotId: activeApplication.snapshotId,
          appliedAt: activeApplication.appliedAt,
          revertedAt: activeApplication.revertedAt,
        })
      : null;

    const payload = buildManagerReviewWorkspacePayload({
      cycleId: cycle.id,
      subjectRecords: workspaceRecords.subjectRecords,
      raterRecords: workspaceRecords.raterRecords,
      application,
      targetBucketCount: activeApplication?.snapshot.targetBucketCount ?? 5,
    });

    return NextResponse.json({
      cycle: { id: cycle.id, name: cycle.name },
      cycleId: payload.cycleId,
      source: payload.source,
      strategy: payload.strategy,
      targetBucketCount: payload.targetBucketCount,
      application: payload.application,
      summary: payload.summary,
      rawDistribution: payload.rawDistribution,
      reviewerNormalizedDistribution: payload.reviewerNormalizedDistribution,
      departmentNormalizedDistribution: payload.departmentNormalizedDistribution,
      raterBiasRows: payload.reviewerBiasRows,
      movementRows: payload.movementRows,
      applicationState: payload.applicationState,
    });
  } catch (error) {
    return jsonError((error as Error).message, 500);
  }
}
