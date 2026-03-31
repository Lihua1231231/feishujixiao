import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computePeerReviewAverageFromReviews } from "@/lib/peer-review-summary";
import {
  applyScoreNormalizationLayer,
  type ScoreNormalizationRawRecord,
  type ScoreNormalizationSource,
} from "@/lib/score-normalization";
import { canApplyScoreNormalization } from "@/lib/score-normalization-permissions";
import { computeWeightedScoreFromDimensions, roundToOneDecimal } from "@/lib/weighted-score";
import { getActiveCycle, getSessionUser } from "@/lib/session";
import type {
  ScoreNormalizationApplyRequest,
  ScoreNormalizationRaterRecord,
} from "@/components/score-normalization/types";

function resolveSource(request: NextRequest, body: ScoreNormalizationApplyRequest): ScoreNormalizationSource {
  const source = body.source ?? request.nextUrl.searchParams.get("source");
  return source === "SUPERVISOR_EVAL" ? "SUPERVISOR_EVAL" : "PEER_REVIEW";
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

  const subjectRecords: ScoreNormalizationRawRecord[] = [...subjectGroups.entries()].map(([revieweeId, list]) => ({
    sourceRecordId: revieweeId,
    subjectId: revieweeId,
    subjectName: list[0]?.reviewee.name ?? null,
    subjectDepartment: list[0]?.reviewee.department ?? null,
    score: computePeerReviewAverageFromReviews(list),
  }));

  const raterRecords: ScoreNormalizationRaterRecord[] = reviews.map((review) => ({
    sourceRecordId: review.id,
    subjectId: review.revieweeId,
    subjectName: review.reviewee.name ?? null,
    subjectDepartment: review.reviewee.department ?? null,
    raterId: review.reviewerId,
    raterName: review.reviewer.name ?? null,
    raterDepartment: review.reviewer.department ?? null,
    score: computePeerReviewAverageFromReviews([review]),
  }));

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

  const subjectRecords: ScoreNormalizationRawRecord[] = [...subjectGroups.entries()].map(([employeeId, list]) => ({
    sourceRecordId: employeeId,
    subjectId: employeeId,
    subjectName: list[0]?.item.employee.name ?? null,
    subjectDepartment: list[0]?.item.employee.department ?? null,
    score: average(list.map((entry) => entry.score)),
  }));

  const raterRecords: ScoreNormalizationRaterRecord[] = evalScores.map(({ item, score }) => ({
    sourceRecordId: item.id,
    subjectId: item.employeeId,
    subjectName: item.employee.name ?? null,
    subjectDepartment: item.employee.department ?? null,
    raterId: item.evaluatorId,
    raterName: item.evaluator.name ?? null,
    raterDepartment: item.evaluator.department ?? null,
    score,
  }));

  return { subjectRecords, raterRecords };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    if (!canApplyScoreNormalization(user)) return NextResponse.json({ error: "无权执行标准化应用" }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as ScoreNormalizationApplyRequest;
    if (body.confirmed !== true) {
      return NextResponse.json({ error: "请先确认这会影响排名和后续校准展示" }, { status: 400 });
    }

    const cycle = await getActiveCycle();
    if (!cycle) return NextResponse.json({ error: "当前无活动周期" }, { status: 404 });

    const source = resolveSource(request, body);
    const workspaceRecords = source === "PEER_REVIEW"
      ? await loadPeerReviewWorkspaceRecords(cycle.id)
      : await loadSupervisorEvalWorkspaceRecords(cycle.id);

    const snapshotId = randomUUID();
    const appliedAt = new Date();
    const result = applyScoreNormalizationLayer({
      cycleId: cycle.id,
      source,
      snapshotId,
      rawRecords: workspaceRecords.subjectRecords,
      raterRecords: workspaceRecords.raterRecords,
      targetBucketCount: 5,
      appliedAt,
    });

    await prisma.$transaction(async (tx) => {
      await tx.scoreNormalizationSnapshot.create({
        data: {
          id: snapshotId,
          cycleId: cycle.id,
          source,
          strategy: result.snapshot.strategy,
          targetBucketCount: result.snapshot.targetBucketCount,
          rawRecordCount: result.snapshot.rawRecordCount,
          createdAt: result.snapshot.createdAt,
        },
      });

      if (result.snapshot.entries.length > 0) {
        await tx.scoreNormalizationEntry.createMany({
          data: result.snapshot.entries.map((entry) => ({
            snapshotId,
            sourceRecordId: entry.sourceRecordId,
            subjectId: entry.subjectId,
            subjectName: entry.subjectName ?? "",
            rawScore: entry.rawScore,
            rankIndex: entry.rankIndex,
            bucketIndex: entry.bucketIndex,
            bucketLabel: entry.bucketLabel ?? "",
            normalizedScore: entry.normalizedScore,
          })),
        });
      }

      await tx.scoreNormalizationApplication.upsert({
        where: {
          cycleId_source: {
            cycleId: cycle.id,
            source,
          },
        },
        update: {
          snapshotId: result.application.snapshotId,
          appliedAt: result.application.appliedAt,
          revertedAt: result.application.revertedAt,
        },
        create: {
          cycleId: result.application.cycleId,
          source: result.application.source,
          snapshotId: result.application.snapshotId,
          appliedAt: result.application.appliedAt,
          revertedAt: result.application.revertedAt,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      cycle: { id: cycle.id, name: cycle.name },
      source,
      applicationState: {
        workspaceState: "STANDARDIZED",
        appliedAt: appliedAt.toISOString(),
        revertedAt: null,
        snapshotId,
        rollbackVisible: true,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
