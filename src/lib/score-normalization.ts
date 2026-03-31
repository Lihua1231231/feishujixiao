export type ScoreNormalizationSource = "360" | "performance";

export type ScoreNormalizationStrategy = "RANK_BUCKET";

export type ScoreNormalizationRawRecord = {
  id: string;
  subjectId: string;
  subjectName?: string | null;
  score: number | null;
};

export type ScoreNormalizationBucketSummary = {
  bucketIndex: number;
  bucketLabel: string;
  count: number;
  pct: number;
  names: string[];
};

export type ScoreNormalizationEntryShape = {
  sourceRecordId: string;
  subjectId: string;
  subjectName: string | null;
  rawScore: number | null;
  rankIndex: number | null;
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
  status: "APPLIED" | "REVERTED";
};

export type ScoreNormalizationWorkspacePayload = {
  cycleId: string;
  source: ScoreNormalizationSource;
  strategy: ScoreNormalizationStrategy;
  targetBucketCount: number;
  rawDistribution: ScoreNormalizationBucketSummary[];
  simulatedDistribution: ScoreNormalizationBucketSummary[];
  application: ScoreNormalizationApplicationShape | null;
  snapshot: ScoreNormalizationSnapshotShape;
};

export type ScoreNormalizationApplyResult = ScoreNormalizationWorkspacePayload & {
  application: ScoreNormalizationApplicationShape;
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
  const rounded = Number.isFinite(requestedBucketCount ?? NaN)
    ? Math.round(requestedBucketCount ?? 5)
    : 5;
  return Math.min(5, Math.max(1, rounded));
}

function bucketLabelForIndex(bucketIndex: number) {
  return `第${bucketIndex}档`;
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

export function buildTargetBucketCount(totalCount: number, requestedBucketCount = 5) {
  const targetCount = normalizeBucketCount(requestedBucketCount);
  if (totalCount <= 0) return targetCount;
  return Math.min(targetCount, Math.max(1, totalCount));
}

export function assignRankBuckets(
  rawRecords: ScoreNormalizationRawRecord[],
  bucketCount = 5,
): ScoreNormalizationEntryShape[] {
  const scoredRecords = rawRecords
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => record.score != null && !Number.isNaN(record.score as number))
    .sort((left, right) => {
      const scoreDiff = (right.record.score as number) - (left.record.score as number);
      if (scoreDiff !== 0) return scoreDiff;
      return left.record.id.localeCompare(right.record.id);
    });

  const assignedEntries = scoredRecords.map(({ record }, index) => {
    const bucketIndex = Math.min(bucketCount, Math.floor((index * bucketCount) / scoredRecords.length) + 1);
    return {
      sourceRecordId: record.id,
      subjectId: record.subjectId,
      subjectName: record.subjectName?.trim() || null,
      rawScore: record.score,
      rankIndex: index + 1,
      bucketIndex,
      bucketLabel: bucketLabelForIndex(bucketIndex),
      normalizedScore: bucketCount - bucketIndex + 1,
    };
  });

  const unscoredEntries = rawRecords
    .filter((record) => record.score == null || Number.isNaN(record.score as number))
    .map((record) => ({
      sourceRecordId: record.id,
      subjectId: record.subjectId,
      subjectName: record.subjectName?.trim() || null,
      rawScore: record.score,
      rankIndex: null,
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
  const buckets = buildEmptyBucketSummaries(bucketCount);
  let counted = 0;

  for (const record of rawRecords) {
    const bucketIndex = normalizeRawScore(record.score, bucketCount);
    if (bucketIndex == null) continue;
    counted += 1;
    const bucket = buckets[bucketIndex - 1];
    bucket.count += 1;
    bucket.names.push(getDisplayName(record));
  }

  return finalizeBucketSummaries(buckets, counted);
}

export function summarizeSimulatedDistribution(
  entries: ScoreNormalizationEntryShape[],
  bucketCount = 5,
): ScoreNormalizationBucketSummary[] {
  const buckets = buildEmptyBucketSummaries(bucketCount);
  let counted = 0;

  for (const entry of entries) {
    if (entry.bucketIndex == null) continue;
    counted += 1;
    const bucket = buckets[entry.bucketIndex - 1];
    bucket.count += 1;
    bucket.names.push(entry.subjectName?.trim() || entry.subjectId);
  }

  return finalizeBucketSummaries(buckets, counted);
}

export function shapeScoreNormalizationSnapshot(params: {
  cycleId: string;
  source: ScoreNormalizationSource;
  rawRecords: ScoreNormalizationRawRecord[];
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
  rawRecords: ScoreNormalizationRawRecord[];
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
    status: params.revertedAt ? "REVERTED" : "APPLIED",
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
  rawRecords: ScoreNormalizationRawRecord[];
  application?: ScoreNormalizationApplicationShape | null;
  targetBucketCount?: number;
  strategy?: ScoreNormalizationStrategy;
}): ScoreNormalizationWorkspacePayload {
  const snapshot = shapeScoreNormalizationSnapshot(params);
  return {
    cycleId: snapshot.cycleId,
    source: snapshot.source,
    strategy: snapshot.strategy,
    targetBucketCount: snapshot.targetBucketCount,
    rawDistribution: summarizeRawScoreDistribution(params.rawRecords, snapshot.targetBucketCount),
    simulatedDistribution: snapshot.simulatedDistribution,
    application: params.application ?? null,
    snapshot,
  };
}

export function applyScoreNormalizationLayer(params: {
  cycleId: string;
  source: ScoreNormalizationSource;
  snapshotId: string;
  rawRecords: ScoreNormalizationRawRecord[];
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
    cycleId: snapshot.cycleId,
    source: snapshot.source,
    strategy: snapshot.strategy,
    targetBucketCount: snapshot.targetBucketCount,
    rawDistribution: summarizeRawScoreDistribution(params.rawRecords, snapshot.targetBucketCount),
    simulatedDistribution: snapshot.simulatedDistribution,
    application,
    snapshot,
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
