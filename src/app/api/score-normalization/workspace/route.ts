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

function resolveSource(request: NextRequest): ScoreNormalizationSource {
  return request.nextUrl.searchParams.get("source") === "SUPERVISOR_EVAL" ? "SUPERVISOR_EVAL" : "PEER_REVIEW";
}

function sortByName(left: ScoreNormalizationRawRecord, right: ScoreNormalizationRawRecord) {
  return (left.subjectName ?? left.subjectId).localeCompare(right.subjectName ?? right.subjectId, "zh-Hans-CN");
}

async function loadPeerReviewRawRecords(cycleId: string): Promise<ScoreNormalizationRawRecord[]> {
  const reviews = await prisma.peerReview.findMany({
    where: { cycleId, status: "SUBMITTED" },
    select: {
      revieweeId: true,
      reviewee: { select: { name: true } },
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

  const grouped = new Map<string, typeof reviews>();
  for (const review of reviews) {
    const list = grouped.get(review.revieweeId) ?? [];
    list.push(review);
    grouped.set(review.revieweeId, list);
  }

  return [...grouped.entries()]
    .map(([revieweeId, list]) => ({
      id: revieweeId,
      subjectId: revieweeId,
      subjectName: list[0]?.reviewee.name ?? null,
      score: computePeerReviewAverageFromReviews(list),
    }))
    .sort(sortByName);
}

async function loadSupervisorEvalRawRecords(cycleId: string): Promise<ScoreNormalizationRawRecord[]> {
  const evals = await prisma.supervisorEval.findMany({
    where: { cycleId, status: "SUBMITTED" },
    select: {
      employeeId: true,
      employee: { select: { name: true } },
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

  const grouped = new Map<string, typeof evals>();
  for (const evalItem of evals) {
    const list = grouped.get(evalItem.employeeId) ?? [];
    list.push(evalItem);
    grouped.set(evalItem.employeeId, list);
  }

  return [...grouped.entries()]
    .map(([employeeId, list]) => {
      const scores = list
        .map((item) =>
          item.weightedScore ?? computeWeightedScoreFromDimensions({
            performanceStars: item.performanceStars,
            comprehensiveStars: item.comprehensiveStars,
            learningStars: item.learningStars,
            adaptabilityStars: item.adaptabilityStars,
            candidStars: item.candidStars,
            progressStars: item.progressStars,
            altruismStars: item.altruismStars,
            rootStars: item.rootStars,
          }),
        )
        .filter((value): value is number => value != null && !Number.isNaN(value));
      const averageScore = scores.length > 0
        ? roundToOneDecimal(scores.reduce((sum, value) => sum + value, 0) / scores.length)
        : null;

      return {
        id: employeeId,
        subjectId: employeeId,
        subjectName: list[0]?.employee.name ?? null,
        score: averageScore,
      };
    })
    .sort(sortByName);
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
    const rawRecords = source === "PEER_REVIEW"
      ? await loadPeerReviewRawRecords(cycle.id)
      : await loadSupervisorEvalRawRecords(cycle.id);

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
    const application = hasActiveApplication
      ? buildScoreNormalizationApplicationRecord({
          cycleId: activeApplication.cycleId,
          source: activeApplication.source as ScoreNormalizationSource,
          snapshotId: activeApplication.snapshotId,
          appliedAt: activeApplication.appliedAt,
          revertedAt: null,
        })
      : null;
    const targetBucketCount = hasActiveApplication ? activeApplication.snapshot.targetBucketCount : 5;

    const payload = buildScoreNormalizationWorkspacePayload({
      cycleId: cycle.id,
      source,
      rawRecords,
      application,
      targetBucketCount,
    });

    return NextResponse.json({
      cycle: { id: cycle.id, name: cycle.name },
      source,
      ...payload,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
