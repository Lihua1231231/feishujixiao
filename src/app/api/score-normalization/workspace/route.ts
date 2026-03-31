import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computePeerReviewAverageFromReviews } from "@/lib/peer-review-summary";
import {
  buildScoreNormalizationApplicationRecord,
  buildScoreNormalizationWorkspacePayload,
  type ScoreNormalizationRawRecord,
  type ScoreNormalizationSource,
} from "@/lib/score-normalization";
import { canAccessScoreNormalization } from "@/lib/score-normalization-permissions";
import { computeWeightedScoreFromDimensions, roundToOneDecimal } from "@/lib/weighted-score";
import { getActiveCycle, getSessionUser } from "@/lib/session";
import type { ScoreNormalizationRaterRecord } from "@/components/score-normalization/types";

function resolveSource(request: NextRequest): ScoreNormalizationSource {
  return request.nextUrl.searchParams.get("source") === "SUPERVISOR_EVAL" ? "SUPERVISOR_EVAL" : "PEER_REVIEW";
}

function sortByName(left: Pick<ScoreNormalizationRawRecord, "subjectName" | "subjectId">, right: Pick<ScoreNormalizationRawRecord, "subjectName" | "subjectId">) {
  return (left.subjectName ?? left.subjectId).localeCompare(right.subjectName ?? right.subjectId, "zh-Hans-CN");
}

function average(values: Array<number | null | undefined>) {
  const filtered = values.filter((value): value is number => value != null && !Number.isNaN(value));
  if (filtered.length === 0) return null;
  return roundToOneDecimal(filtered.reduce((sum, value) => sum + value, 0) / filtered.length);
}

async function loadPeerReviewWorkspaceRecords(cycleId: string) {
  const reviews = await prisma.peerReview.findMany({
    where: { cycleId, status: "SUBMITTED" },
    select: {
      id: true,
      reviewerId: true,
      reviewer: { select: { name: true, department: true } },
      revieweeId: true,
      reviewee: { select: { name: true, department: true } },
      outputScore: true,
      collaborationScore: true,
      valuesScore: true,
      performanceStars: true,
      comprehensiveStars: true,
      learningStars: true,
      adaptabilityStars: true,
      candidStars: true,
      progressStars: true,
      altruismStars: true,
      rootStars: true,
    },
  });

  const subjectGroups = new Map<string, typeof reviews>();
  for (const review of reviews) {
    const list = subjectGroups.get(review.revieweeId) ?? [];
    list.push(review);
    subjectGroups.set(review.revieweeId, list);
  }

  const subjectRecords = [...subjectGroups.entries()]
    .map(([revieweeId, list]) => ({
      sourceRecordId: revieweeId,
      subjectId: revieweeId,
      subjectName: list[0]?.reviewee.name ?? null,
      subjectDepartment: list[0]?.reviewee.department ?? null,
      score: computePeerReviewAverageFromReviews(list),
    }))
    .sort(sortByName);

  const raterRecords: ScoreNormalizationRaterRecord[] = reviews
    .map((review) => ({
      sourceRecordId: review.id,
      subjectId: review.revieweeId,
      subjectName: review.reviewee.name ?? null,
      subjectDepartment: review.reviewee.department ?? null,
      raterId: review.reviewerId,
      raterName: review.reviewer.name ?? null,
      raterDepartment: review.reviewer.department ?? null,
      score: computePeerReviewAverageFromReviews([review]),
    }))
    .sort((left, right) => {
      const leftName = left.raterName ?? left.raterId;
      const rightName = right.raterName ?? right.raterId;
      return leftName.localeCompare(rightName, "zh-Hans-CN");
    });

  return { subjectRecords, raterRecords };
}

async function loadSupervisorEvalWorkspaceRecords(cycleId: string) {
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

  const evalScores = evals.map((item) => ({
    item,
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
  }));

  const subjectGroups = new Map<string, typeof evalScores>();
  for (const record of evalScores) {
    const list = subjectGroups.get(record.item.employeeId) ?? [];
    list.push(record);
    subjectGroups.set(record.item.employeeId, list);
  }

  const subjectRecords = [...subjectGroups.entries()]
    .map(([employeeId, list]) => ({
      sourceRecordId: employeeId,
      subjectId: employeeId,
      subjectName: list[0]?.item.employee.name ?? null,
      subjectDepartment: list[0]?.item.employee.department ?? null,
      score: average(list.map((entry) => entry.score)),
    }))
    .sort(sortByName);

  const raterRecords: ScoreNormalizationRaterRecord[] = evalScores
    .map(({ item, score }) => ({
      sourceRecordId: item.id,
      subjectId: item.employeeId,
      subjectName: item.employee.name ?? null,
      subjectDepartment: item.employee.department ?? null,
      raterId: item.evaluatorId,
      raterName: item.evaluator.name ?? null,
      raterDepartment: item.evaluator.department ?? null,
      score,
    }))
    .sort((left, right) => {
      const leftName = left.raterName ?? left.raterId;
      const rightName = right.raterName ?? right.raterId;
      return leftName.localeCompare(rightName, "zh-Hans-CN");
    });

  return { subjectRecords, raterRecords };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    if (!canAccessScoreNormalization(user)) {
      return NextResponse.json({ error: "无权查看分布校准" }, { status: 403 });
    }

    const cycle = await getActiveCycle();
    if (!cycle) {
      return NextResponse.json({ error: "当前无活动周期" }, { status: 404 });
    }

    const source = resolveSource(request);
    const workspaceRecords = source === "PEER_REVIEW"
      ? await loadPeerReviewWorkspaceRecords(cycle.id)
      : await loadSupervisorEvalWorkspaceRecords(cycle.id);

    const activeApplication = await prisma.scoreNormalizationApplication.findUnique({
      where: { cycleId_source: { cycleId: cycle.id, source } },
      select: {
        cycleId: true,
        source: true,
        snapshotId: true,
        appliedAt: true,
        revertedAt: true,
        snapshot: { select: { targetBucketCount: true } },
      },
    });

    const hasActiveApplication = activeApplication != null && activeApplication.revertedAt == null;
    const application = activeApplication
      ? buildScoreNormalizationApplicationRecord({
          cycleId: activeApplication.cycleId,
          source: activeApplication.source as ScoreNormalizationSource,
          snapshotId: activeApplication.snapshotId,
          appliedAt: activeApplication.appliedAt,
          revertedAt: activeApplication.revertedAt,
        })
      : null;
    const targetBucketCount = hasActiveApplication ? activeApplication.snapshot.targetBucketCount : 5;

    const payload = buildScoreNormalizationWorkspacePayload({
      cycleId: cycle.id,
      source,
      subjectRecords: workspaceRecords.subjectRecords,
      raterRecords: workspaceRecords.raterRecords,
      application,
      targetBucketCount,
    });
    const {
      summary,
      rawDistribution,
      simulatedDistribution,
      raterBiasRows,
      movementRows,
      applicationState,
      strategy,
    } = payload;

    return NextResponse.json({
      cycle: { id: cycle.id, name: cycle.name },
      ...payload,
      cycleId: payload.cycleId,
      strategy,
      targetBucketCount: payload.targetBucketCount,
      summary,
      rawDistribution,
      simulatedDistribution,
      raterBiasRows,
      movementRows,
      applicationState,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
