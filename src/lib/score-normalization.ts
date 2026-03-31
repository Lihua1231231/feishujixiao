import type {
  ScoreNormalizationApplicationState,
  ScoreNormalizationBucketSummary,
  ScoreNormalizationMovementRow,
  ScoreNormalizationRaterBiasRow,
  ScoreNormalizationRaterRecord,
  ScoreNormalizationSubjectRecord,
  ScoreNormalizationWorkspacePayload as ScoreNormalizationWorkspacePayloadContract,
} from "@/components/score-normalization/types";

export type ScoreNormalizationSource = "PEER_REVIEW" | "SUPERVISOR_EVAL";

export type ScoreNormalizationStrategy = "RANK_BUCKET";

export type ScoreNormalizationRawRecord = ScoreNormalizationSubjectRecord;

export type ScoreNormalizationEntryShape = {
  sourceRecordId: string;
  subjectId: string;
  subjectName: string | null;
  subjectDepartment: string | null;
  rawScore: number | null;
  rankIndex: number | null;
  rawBucket: number | null;
  bucketIndex: number | null;
  bucketLabel: string | null;
  normalizedScore: number | null;
};

export type ScoreNormalizationSnapshotShape = {
  cycleId: string;
  source: ScoreNormalizationSource;
  strategy: ScoreNormalizationStrategy;
  targetBucketCount: number;
  rawRecordCount: number;
  createdAt: Date;
  entries: ScoreNormalizationEntryShape[];
  simulatedDistribution: ScoreNormalizationBucketSummary[];
};

export type ScoreNormalizationApplicationShape = {
  cycleId: string;
  source: ScoreNormalizationSource;
  snapshotId: string;
  appliedAt: Date;
  revertedAt: Date | null;
};

export type ScoreNormalizationWorkspacePayload = ScoreNormalizationWorkspacePayloadContract;

export type ScoreNormalizationApplyResult = {
  snapshot: ScoreNormalizationSnapshotShape;
  application: ScoreNormalizationApplicationShape;
  payload: ScoreNormalizationWorkspacePayload;
};

export type ScoreNormalizationRevertResult = {
  cycleId: string;
  source: ScoreNormalizationSource;
  where: ReturnType<typeof buildScoreNormalizationApplicationWhere>;
  revertedAt: Date;
};

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizeBucketCount(requestedBucketCount: number | null | undefined) {
  if (!Number.isFinite(requestedBucketCount ?? NaN)) return 5;
  return Math.min(5, Math.max(1, Math.round(requestedBucketCount ?? 5)));
}

function bucketLabelForIndex(bucketIndex: number) {
  return ["一星", "二星", "三星", "四星", "五星"][bucketIndex - 1] ?? `${bucketIndex}星`;
}

function buildEmptyBucketSummaries(bucketCount: number) {
  return Array.from({ length: bucketCount }, (_, index) => ({
    bucketIndex: index + 1,
    bucketLabel: bucketLabelForIndex(index + 1),
    count: 0,
    pct: 0,
    names: [] as string[],
  }));
}

function finalizeBucketSummaries(buckets: ScoreNormalizationBucketSummary[], total: number) {
  return buckets.map((bucket) => ({
    ...bucket,
    pct: total > 0 ? roundToOneDecimal((bucket.count / total) * 100) : 0,
    names: [...bucket.names],
  }));
}

function normalizeRawScore(rawScore: number | null | undefined, bucketCount: number) {
  if (rawScore == null || Number.isNaN(rawScore)) return null;
  const rounded = Math.round(rawScore);
  return Math.min(bucketCount, Math.max(1, rounded));
}

function getDisplayName(record: ScoreNormalizationRawRecord) {
  return record.subjectName?.trim() || record.subjectId;
}

function getDisplayDepartment(record: ScoreNormalizationSubjectRecord) {
  return record.subjectDepartment?.trim() || "";
}

function getRecordId(record: ScoreNormalizationSubjectRecord | ScoreNormalizationRawRecord | { id?: string; subjectId: string }) {
  return (record as { sourceRecordId?: string; id?: string }).sourceRecordId
    ?? (record as { sourceRecordId?: string; id?: string }).id
    ?? record.subjectId;
}

function getMovementLabel(delta: number | null) {
  if (delta == null) return "待定" as const;
  if (delta > 0) return "上调" as const;
  if (delta < 0) return "下调" as const;
  return "不变" as const;
}

export function buildTargetBucketCount(_totalCount: number, requestedBucketCount = 5) {
  return normalizeBucketCount(requestedBucketCount);
}

export type ScoreNormalizationTargetDistribution = {
  oneStarCount: number;
  twoStarCount: number;
  threeStarCount: number;
  fourStarCount: number;
  fiveStarCount: number;
};

export function buildTargetDistributionCounts(totalCount: number): ScoreNormalizationTargetDistribution {
  const normalizedTotal = Math.max(0, Math.floor(totalCount));
  const fiveStarCount = Math.floor(normalizedTotal * 0.1);
  const fourStarCount = Math.floor(normalizedTotal * 0.2);
  const twoStarCount = Math.floor(normalizedTotal * 0.15);
  const oneStarCount = Math.floor(normalizedTotal * 0.05);
  const threeStarCount = Math.max(
    0,
    normalizedTotal - fiveStarCount - fourStarCount - twoStarCount - oneStarCount,
  );

  return {
    oneStarCount,
    twoStarCount,
    threeStarCount,
    fourStarCount,
    fiveStarCount,
  };
}

export function assignRankBuckets(
  rawRecords: ScoreNormalizationRawRecord[],
  _bucketCount = 5,
): ScoreNormalizationEntryShape[] {
  const bucketCount = normalizeBucketCount(_bucketCount);
  const distribution = buildTargetDistributionCounts(
    rawRecords.filter((record) => record.score != null && !Number.isNaN(record.score as number)).length,
  );
  const scoredRecords = rawRecords
    .map((record) => ({ record }))
    .filter(({ record }) => record.score != null && !Number.isNaN(record.score as number))
    .sort((left, right) => {
      const scoreDiff = (right.record.score as number) - (left.record.score as number);
      if (scoreDiff !== 0) return scoreDiff;
      return getRecordId(left.record).localeCompare(getRecordId(right.record));
    });

  const fiveBoundary = distribution.fiveStarCount;
  const fourBoundary = fiveBoundary + distribution.fourStarCount;
  const threeBoundary = fourBoundary + distribution.threeStarCount;
  const twoBoundary = threeBoundary + distribution.twoStarCount;

  const assignedEntries = scoredRecords.map(({ record }, index) => {
    const bucketIndex = index < fiveBoundary
      ? 5
      : index < fourBoundary
        ? 4
        : index < threeBoundary
          ? 3
          : index < twoBoundary
            ? 2
            : 1;
    return {
      sourceRecordId: getRecordId(record),
      subjectId: record.subjectId,
      subjectName: record.subjectName?.trim() || null,
      subjectDepartment: getDisplayDepartment(record),
      rawScore: record.score,
      rankIndex: index + 1,
      rawBucket: normalizeRawScore(record.score, bucketCount),
      bucketIndex,
      bucketLabel: bucketLabelForIndex(bucketIndex),
      normalizedScore: bucketIndex,
    };
  });

  const unscoredEntries = rawRecords
    .filter((record) => record.score == null || Number.isNaN(record.score as number))
    .map((record) => ({
      sourceRecordId: getRecordId(record),
      subjectId: record.subjectId,
      subjectName: record.subjectName?.trim() || null,
      subjectDepartment: getDisplayDepartment(record),
      rawScore: record.score,
      rankIndex: null,
      rawBucket: null,
      bucketIndex: null,
      bucketLabel: null,
      normalizedScore: null,
    }));

  return [...assignedEntries, ...unscoredEntries];
}

export function summarizeRawScoreDistribution(
  rawRecords: ScoreNormalizationRawRecord[],
  bucketCount = 5,
): ScoreNormalizationBucketSummary[] {
  const buckets = buildEmptyBucketSummaries(normalizeBucketCount(bucketCount));
  let counted = 0;

  for (const record of rawRecords) {
    const bucketIndex = normalizeRawScore(record.score, buckets.length);
    if (bucketIndex == null) continue;
    counted += 1;
    const bucket = buckets[bucketIndex - 1];
    bucket.count += 1;
    bucket.names.push(getDisplayName(record));
  }

  return finalizeBucketSummaries(buckets, counted);
}

export function summarizeSimulatedDistribution(
  entries: Array<{ bucketIndex?: number | null; normalizedBucket?: number | null; subjectId: string; subjectName?: string | null }>,
  bucketCount = 5,
): ScoreNormalizationBucketSummary[] {
  const buckets = buildEmptyBucketSummaries(normalizeBucketCount(bucketCount));
  let counted = 0;

  for (const entry of entries) {
    const bucketIndex = entry.bucketIndex ?? entry.normalizedBucket;
    if (bucketIndex == null) continue;
    counted += 1;
    const bucket = buckets[bucketIndex - 1];
    bucket.count += 1;
    bucket.names.push(entry.subjectName?.trim() || entry.subjectId);
  }

  return finalizeBucketSummaries(buckets, counted);
}

export function buildScoreNormalizationMovementRows(
  subjectRecords: ScoreNormalizationSubjectRecord[],
  bucketCount = 5,
): ScoreNormalizationMovementRow[] {
  const rankedEntries = assignRankBuckets(subjectRecords, bucketCount);
  return rankedEntries
    .map((entry) => {
      const rawBucket = normalizeRawScore(entry.rawScore, bucketCount);
      const normalizedBucket = entry.bucketIndex ?? null;
      const rankDelta = rawBucket != null && normalizedBucket != null ? normalizedBucket - rawBucket : null;

      return {
        sourceRecordId: entry.sourceRecordId,
        subjectId: entry.subjectId,
        subjectName: entry.subjectName,
        subjectDepartment: entry.subjectDepartment,
        rawScore: entry.rawScore,
        rawBucket,
        normalizedBucket,
        rankIndex: entry.rankIndex,
        rankDelta,
        movementLabel: getMovementLabel(rankDelta),
      };
    })
    .sort((left, right) => {
      const leftDelta = Math.abs(left.rankDelta ?? 0);
      const rightDelta = Math.abs(right.rankDelta ?? 0);
      if (rightDelta !== leftDelta) return rightDelta - leftDelta;
      if ((right.rawScore ?? -Infinity) !== (left.rawScore ?? -Infinity)) {
        return (right.rawScore ?? -Infinity) - (left.rawScore ?? -Infinity);
      }
      return left.subjectId.localeCompare(right.subjectId);
    });
}

export function buildScoreNormalizationRaterBiasRows(
  raterRecords: ScoreNormalizationRaterRecord[],
): ScoreNormalizationRaterBiasRow[] {
  const scoredRecords = raterRecords.filter((record) => record.score != null && !Number.isNaN(record.score as number));
  const overallAverage = scoredRecords.length > 0
    ? roundToOneDecimal(scoredRecords.reduce((sum, record) => sum + (record.score as number), 0) / scoredRecords.length)
    : null;

  const grouped = new Map<string, ScoreNormalizationRaterRecord[]>();
  for (const record of raterRecords) {
    const list = grouped.get(record.raterId) ?? [];
    list.push(record);
    grouped.set(record.raterId, list);
  }

  return [...grouped.entries()]
    .map(([raterId, records]) => {
      const scored = records
        .map((record) => record.score)
        .filter((score): score is number => score != null && !Number.isNaN(score));
      const sampleCount = scored.length;
      const averageScore = sampleCount > 0
        ? roundToOneDecimal(scored.reduce((sum, score) => sum + score, 0) / sampleCount)
        : null;
      const offset = averageScore != null && overallAverage != null
        ? roundToOneDecimal(averageScore - overallAverage)
        : null;
      const tendency = offset == null
        ? "正常"
        : offset > 0.3
          ? "偏高"
          : offset < -0.3
            ? "偏低"
            : "正常";
      const normalizedTendency: ScoreNormalizationRaterBiasRow["tendency"] = tendency;
      const isAbnormal = sampleCount >= 2 && offset != null && Math.abs(offset) >= 0.3;
      const first = records[0];

      return {
        raterId,
        raterName: first.raterName?.trim() || first.raterId,
        raterDepartment: first.raterDepartment?.trim() || null,
        sampleCount,
        averageScore,
        offset,
        tendency: normalizedTendency,
        isAbnormal,
      };
    })
    .sort((left, right) => {
      if (left.isAbnormal !== right.isAbnormal) return left.isAbnormal ? -1 : 1;
      const leftAbs = Math.abs(left.offset ?? 0);
      const rightAbs = Math.abs(right.offset ?? 0);
      if (rightAbs !== leftAbs) return rightAbs - leftAbs;
      if (right.sampleCount !== left.sampleCount) return right.sampleCount - left.sampleCount;
      return left.raterName.localeCompare(right.raterName, "zh-Hans-CN");
    });
}

function countSkewedDepartments(subjectRecords: ScoreNormalizationSubjectRecord[]) {
  const scoredRecords = subjectRecords.filter((record) => record.score != null && !Number.isNaN(record.score));
  if (scoredRecords.length === 0) return 0;

  const overallAverage = roundToOneDecimal(
    scoredRecords.reduce((sum, record) => sum + (record.score as number), 0) / scoredRecords.length,
  );

  const grouped = new Map<string, ScoreNormalizationSubjectRecord[]>();
  for (const record of scoredRecords) {
    const key = getDisplayDepartment(record);
    const list = grouped.get(key) ?? [];
    list.push(record);
    grouped.set(key, list);
  }

  return [...grouped.values()].filter((records) => {
    if (records.length < 2) return false;
    const average = roundToOneDecimal(records.reduce((sum, record) => sum + (record.score as number), 0) / records.length);
    return Math.abs((average ?? 0) - (overallAverage ?? 0)) >= 0.3;
  }).length;
}

export function buildScoreNormalizationApplicationState(
  application: ScoreNormalizationApplicationShape | null,
): ScoreNormalizationApplicationState {
  const workspaceState = application && application.revertedAt == null ? "STANDARDIZED" : "RAW";
  return {
    workspaceState,
    appliedAt: application ? application.appliedAt.toISOString() : null,
    revertedAt: application?.revertedAt ? application.revertedAt.toISOString() : null,
    snapshotId: application?.snapshotId ?? null,
    rollbackVisible: workspaceState === "STANDARDIZED",
  };
}

export function buildScoreNormalizationWorkspaceSummary(params: {
  subjectRecords: ScoreNormalizationSubjectRecord[];
  raterBiasRows: ScoreNormalizationRaterBiasRow[];
  movementRows: ScoreNormalizationMovementRow[];
  applicationState: ScoreNormalizationApplicationState;
}) {
  return {
    currentSourceCount: params.subjectRecords.length,
    abnormalRaterCount: params.raterBiasRows.filter((row) => row.isAbnormal).length,
    shiftedPeopleCount: params.movementRows.filter((row) => (row.rankDelta ?? 0) !== 0).length,
    skewedDepartmentCount: countSkewedDepartments(params.subjectRecords),
    workspaceState: params.applicationState.workspaceState,
  };
}

export function shapeScoreNormalizationSnapshot(params: {
  cycleId: string;
  source: ScoreNormalizationSource;
  rawRecords: ScoreNormalizationSubjectRecord[];
  targetBucketCount?: number;
  strategy?: ScoreNormalizationStrategy;
}) {
  const targetBucketCount = buildTargetBucketCount(
    params.rawRecords.length,
    params.targetBucketCount ?? 5,
  );
  const entries = assignRankBuckets(params.rawRecords, targetBucketCount);

  return {
    cycleId: params.cycleId,
    source: params.source,
    strategy: params.strategy ?? "RANK_BUCKET",
    targetBucketCount,
    rawRecordCount: params.rawRecords.length,
    createdAt: new Date(),
    entries,
    simulatedDistribution: summarizeSimulatedDistribution(entries, targetBucketCount),
  } satisfies ScoreNormalizationSnapshotShape;
}

export function simulateScoreNormalizationLayer(params: {
  cycleId: string;
  source: ScoreNormalizationSource;
  rawRecords: ScoreNormalizationSubjectRecord[];
  targetBucketCount?: number;
  strategy?: ScoreNormalizationStrategy;
}) {
  return shapeScoreNormalizationSnapshot(params);
}

export function buildScoreNormalizationApplicationRecord(params: {
  cycleId: string;
  source: ScoreNormalizationSource;
  snapshotId: string;
  appliedAt?: Date;
  revertedAt?: Date | null;
}): ScoreNormalizationApplicationShape {
  return {
    cycleId: params.cycleId,
    source: params.source,
    snapshotId: params.snapshotId,
    appliedAt: params.appliedAt ?? new Date(),
    revertedAt: params.revertedAt ?? null,
  };
}

export function buildScoreNormalizationApplicationWhere(params: {
  cycleId: string;
  source: ScoreNormalizationSource;
}) {
  return {
    cycleId: params.cycleId,
    source: params.source,
  } as const;
}

export function buildScoreNormalizationWorkspacePayload(params: {
  cycleId: string;
  source: ScoreNormalizationSource;
  subjectRecords: ScoreNormalizationSubjectRecord[];
  raterRecords: ScoreNormalizationRaterRecord[];
  application?: ScoreNormalizationApplicationShape | null;
  targetBucketCount?: number;
  strategy?: ScoreNormalizationStrategy;
}): ScoreNormalizationWorkspacePayload {
  const snapshot = shapeScoreNormalizationSnapshot({
    cycleId: params.cycleId,
    source: params.source,
    rawRecords: params.subjectRecords,
    targetBucketCount: params.targetBucketCount,
    strategy: params.strategy,
  });
  const raterBiasRows = buildScoreNormalizationRaterBiasRows(params.raterRecords);
  const movementRows = buildScoreNormalizationMovementRows(params.subjectRecords, snapshot.targetBucketCount);
  const applicationState = buildScoreNormalizationApplicationState(params.application ?? null);

  return {
    cycleId: snapshot.cycleId,
    source: snapshot.source,
    strategy: snapshot.strategy,
    targetBucketCount: snapshot.targetBucketCount,
    summary: buildScoreNormalizationWorkspaceSummary({
      subjectRecords: params.subjectRecords,
      raterBiasRows,
      movementRows,
      applicationState,
    }),
    rawDistribution: summarizeRawScoreDistribution(params.subjectRecords, snapshot.targetBucketCount),
    simulatedDistribution: snapshot.simulatedDistribution,
    raterBiasRows,
    movementRows,
    applicationState,
  };
}

export function applyScoreNormalizationLayer(params: {
  cycleId: string;
  source: ScoreNormalizationSource;
  snapshotId: string;
  rawRecords: ScoreNormalizationSubjectRecord[];
  raterRecords?: ScoreNormalizationRaterRecord[];
  application?: ScoreNormalizationApplicationShape | null;
  targetBucketCount?: number;
  strategy?: ScoreNormalizationStrategy;
  appliedAt?: Date;
}): ScoreNormalizationApplyResult {
  const snapshot = shapeScoreNormalizationSnapshot(params);
  const application =
    params.application ??
    buildScoreNormalizationApplicationRecord({
      cycleId: params.cycleId,
      source: params.source,
      snapshotId: params.snapshotId,
      appliedAt: params.appliedAt,
    });

  return {
    snapshot,
    application,
    payload: buildScoreNormalizationWorkspacePayload({
      cycleId: params.cycleId,
      source: params.source,
      subjectRecords: params.rawRecords,
      raterRecords: params.raterRecords ?? [],
      application,
      targetBucketCount: params.targetBucketCount,
      strategy: params.strategy,
    }),
  };
}

export function revertScoreNormalizationLayer(params: {
  cycleId: string;
  source: ScoreNormalizationSource;
  revertedAt?: Date;
}): ScoreNormalizationRevertResult {
  return {
    cycleId: params.cycleId,
    source: params.source,
    where: buildScoreNormalizationApplicationWhere(params),
    revertedAt: params.revertedAt ?? new Date(),
  };
}

export function getAppliedNormalizationMap(
  applications: ScoreNormalizationApplicationShape[],
) {
  const map = new Map<string, ScoreNormalizationApplicationShape>();
  for (const application of applications) {
    if (application.revertedAt) continue;
    map.set(`${application.cycleId}:${application.source}`, application);
  }
  return map;
}
