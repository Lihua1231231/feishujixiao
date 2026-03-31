import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCycle, getSessionUser } from "@/lib/session";
import { canApplyScoreNormalization } from "@/lib/score-normalization-permissions";
import { computeWeightedScoreFromDimensions, roundToOneDecimal } from "@/lib/weighted-score";
import {
  applyManagerReviewNormalizationLayer,
  type ManagerReviewRaterRecord,
  type ManagerReviewSubjectRecord,
} from "@/lib/manager-review-normalization";

function average(values: Array<number | null | undefined>) {
  const filtered = values.filter((value): value is number => value != null && !Number.isNaN(value));
  if (filtered.length === 0) return null;
  return roundToOneDecimal(filtered.reduce((sum, value) => sum + value, 0) / filtered.length);
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

  const grouped = new Map<string, ManagerReviewRaterRecord[]>();
  for (const record of raterRecords) {
    const list = grouped.get(record.subjectId) ?? [];
    list.push(record);
    grouped.set(record.subjectId, list);
  }

  const subjectRecords: ManagerReviewSubjectRecord[] = [...grouped.entries()].map(([subjectId, list]) => ({
    sourceRecordId: subjectId,
    subjectId,
    subjectName: list[0]?.subjectName ?? null,
    subjectDepartment: list[0]?.subjectDepartment ?? null,
    score: average(list.map((entry) => entry.score)),
  }));

  return { subjectRecords, raterRecords };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    if (!canApplyScoreNormalization(user)) {
      return NextResponse.json({ error: "无权执行标准化应用" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { confirmed?: boolean };
    if (body.confirmed !== true) {
      return NextResponse.json({ error: "请先确认这会影响排名和后续校准展示" }, { status: 400 });
    }

    const cycle = await getActiveCycle();
    if (!cycle) return NextResponse.json({ error: "当前无活动周期" }, { status: 404 });

    const workspaceRecords = await loadManagerReviewWorkspaceRecords(cycle.id);
    const snapshotId = randomUUID();
    const appliedAt = new Date();
    const result = applyManagerReviewNormalizationLayer({
      cycleId: cycle.id,
      snapshotId,
      subjectRecords: workspaceRecords.subjectRecords,
      raterRecords: workspaceRecords.raterRecords,
      appliedAt,
    });

    await prisma.$transaction(async (tx) => {
      await tx.managerReviewNormalizationSnapshot.create({
        data: {
          id: snapshotId,
          cycleId: cycle.id,
          source: result.snapshot.source,
          strategy: result.snapshot.strategy,
          targetBucketCount: result.snapshot.targetBucketCount,
          rawRecordCount: result.snapshot.rawRecordCount,
          reviewerNormalizedCount: result.snapshot.entries.filter((entry) => entry.reviewerNormalizedStars != null).length,
          departmentNormalizedCount: result.snapshot.entries.filter((entry) => entry.departmentNormalizedStars != null).length,
          createdById: user.id,
          createdAt: result.snapshot.createdAt,
        },
      });

      if (result.snapshot.entries.length > 0) {
        await tx.managerReviewNormalizationEntry.createMany({
          data: result.snapshot.entries.map((entry) => ({
            snapshotId,
            sourceRecordId: entry.sourceRecordId,
            subjectId: entry.subjectId,
            subjectName: entry.subjectName ?? "",
            department: entry.subjectDepartment ?? "",
            rawScore: entry.rawScore,
            rawStars: entry.rawStars,
            reviewerBiasDelta: entry.reviewerBiasDelta,
            reviewerAdjustedScore: entry.reviewerAdjustedScore,
            reviewerNormalizedStars: entry.reviewerNormalizedStars,
            reviewerRankIndex: entry.reviewerRankIndex,
            departmentNormalizedStars: entry.departmentNormalizedStars,
            departmentRankIndex: entry.departmentRankIndex,
            movement: entry.movementLabel,
          })),
        });
      }

      await tx.managerReviewNormalizationApplication.upsert({
        where: {
          cycleId_source: {
            cycleId: cycle.id,
            source: "SUPERVISOR_EVAL",
          },
        },
        update: {
          snapshotId,
          appliedAt,
          revertedAt: null,
          appliedById: user.id,
          revertedById: null,
        },
        create: {
          cycleId: cycle.id,
          source: "SUPERVISOR_EVAL",
          snapshotId,
          appliedById: user.id,
          appliedAt,
          revertedAt: null,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      cycle: { id: cycle.id, name: cycle.name },
      applicationState: result.payload.applicationState,
      snapshotId,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
