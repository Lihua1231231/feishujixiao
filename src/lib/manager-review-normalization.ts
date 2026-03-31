import { roundToOneDecimal } from "@/lib/weighted-score";

export type ManagerReviewNormalizationSource = "SUPERVISOR_EVAL" | never;

export type ManagerReviewNormalizationStrategy = "REVIEWER_THEN_DEPARTMENT_BUCKET";

export type ManagerReviewNormalizationLayer = "RAW" | "REVIEWER_NORMALIZED" | "DEPARTMENT_NORMALIZED";

export type ManagerReviewSubjectRecord = {
  sourceRecordId: string;
  subjectId: string;
  subjectName: string | null;
  subjectDepartment: string | null;
  score: number | null;
};

export type ManagerReviewRaterRecord = ManagerReviewSubjectRecord & {
  raterId: string;
  raterName: string | null;
  raterDepartment: string | null;
};

export type ManagerReviewRaterBiasRow = {
  raterId: string;
  raterName: string;
  raterDepartment: string | null;
  sampleCount: number;
  averageScore: number | null;
  offset: number | null;
  tendency: "偏高" | "偏低" | "正常";
  isAbnormal: boolean;
};

export type ManagerReviewBucketSummary = {
  bucketIndex: number;
  bucketLabel: string;
  count: number;
  pct: number;
  names: string[];
};

export type ManagerReviewMovementRow = {
  sourceRecordId: string;
  subjectId: string;
  subjectName: string | null;
  subjectDepartment: string | null;
  rawScore: number | null;
  rawBucket: number | null;
  reviewerBiasDelta: number | null;
  reviewerAdjustedScore: number | null;
  reviewerNormalizedStars: number | null;
  reviewerRankIndex: number | null;
  departmentNormalizedStars: number | null;
  departmentRankIndex: number | null;
  movementLabel: "上调" | "下调" | "不变" | "待定";
};

export type ManagerReviewWorkspaceSummary = {
  currentSourceCount: number;
  abnormalReviewerCount: number;
  shiftedPeopleCount: number;
  skewedDepartmentCount: number;
  workspaceState: "RAW" | "STANDARDIZED";
};

export type ManagerReviewApplicationState = {
  workspaceState: "RAW" | "STANDARDIZED";
  appliedAt: string | null;
  revertedAt: string | null;
  snapshotId: string | null;
  rollbackVisible: boolean;
};

export type ManagerReviewWorkspacePayload = {
  cycleId: string;
  source: ManagerReviewNormalizationSource;
  strategy: ManagerReviewNormalizationStrategy;
  targetBucketCount: number;
  application: ManagerReviewNormalizationApplicationShape | null;
  summary: ManagerReviewWorkspaceSummary;
  rawDistribution: ManagerReviewBucketSummary[];
  reviewerNormalizedDistribution: ManagerReviewBucketSummary[];
  departmentNormalizedDistribution: ManagerReviewBucketSummary[];
  reviewerBiasRows: ManagerReviewRaterBiasRow[];
  movementRows: ManagerReviewMovementRow[];
  applicationState: ManagerReviewApplicationState;
};

export type ManagerReviewNormalizationEntryShape = {
  sourceRecordId: string;
  subjectId: string;
  subjectName: string | null;
  subjectDepartment: string | null;
  rawScore: number | null;
  rawStars: number | null;
  reviewerBiasDelta: number | null;
  reviewerAdjustedScore: number | null;
  reviewerNormalizedStars: number | null;
  reviewerRankIndex: number | null;
  departmentNormalizedStars: number | null;
  departmentRankIndex: number | null;
  movementLabel: ManagerReviewMovementRow["movementLabel"];
};

export type ManagerReviewNormalizationSnapshotShape = {
  cycleId: string;
  source: ManagerReviewNormalizationSource;
  strategy: ManagerReviewNormalizationStrategy;
  targetBucketCount: number;
  rawRecordCount: number;
  createdAt: Date;
  entries: ManagerReviewNormalizationEntryShape[];
  rawDistribution: ManagerReviewBucketSummary[];
  reviewerNormalizedDistribution: ManagerReviewBucketSummary[];
  departmentNormalizedDistribution: ManagerReviewBucketSummary[];
};

export type ManagerReviewNormalizationApplicationShape = {
  cycleId: string;
  source: ManagerReviewNormalizationSource;
  snapshotId: string;
  appliedAt: Date;
  revertedAt: Date | null;
};

export type ManagerReviewApplyResult = {
  snapshot: ManagerReviewNormalizationSnapshotShape;
  application: ManagerReviewNormalizationApplicationShape;
  payload: ManagerReviewWorkspacePayload;
};

export type ManagerReviewRevertResult = {
  cycleId: string;
  source: ManagerReviewNormalizationSource;
  where: ReturnType<typeof buildManagerReviewApplicationWhere>;
  revertedAt: Date;
};

type RankedSubjectRecord = ManagerReviewSubjectRecord & {
  rawStars: number | null;
};

type ReviewerAdjustedSubjectRecord = RankedSubjectRecord & {
  rawScore: number | null;
  reviewerBiasDelta: number | null;
  reviewerAdjustedScore: number | null;
};

type DepartmentNormalizedSubjectRecord = ReviewerAdjustedSubjectRecord & {
  reviewerNormalizedStars: number | null;
  reviewerRankIndex: number | null;
  departmentNormalizedStars: number | null;
  departmentRankIndex: number | null;
};

const SUPERVISOR_EVAL_SOURCE: ManagerReviewNormalizationSource = "SUPERVISOR_EVAL";

function roundScore(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null;
  return roundToOneDecimal(value);
}

function normalizeTargetBucketCount(requestedBucketCount: number | null | undefined) {
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

function finalizeBucketSummaries(buckets: ManagerReviewBucketSummary[], total: number) {
  return buckets.map((bucket) => ({
    ...bucket,
    pct: total > 0 ? roundToOneDecimal((bucket.count / total) * 100) ?? 0 : 0,
    names: [...bucket.names],
  }));
}

function getDisplayName(record: Pick<ManagerReviewSubjectRecord, "subjectName" | "subjectId">) {
  return record.subjectName?.trim() || record.subjectId;
}

function getDepartment(record: Pick<ManagerReviewSubjectRecord, "subjectDepartment">) {
  return record.subjectDepartment?.trim() || "";
}

function average(values: Array<number | null | undefined>) {
  const filtered = values.filter((value): value is number => value != null && !Number.isNaN(value));
  if (filtered.length === 0) return null;
  return roundToOneDecimal(filtered.reduce((sum, value) => sum + value, 0) / filtered.length);
}

function buildTargetBucketCounts(total: number) {
  const normalizedTotal = Math.max(0, Math.floor(total));
  const counts = {
    fiveStarCount: Math.floor(normalizedTotal * 0.1),
    fourStarCount: Math.floor(normalizedTotal * 0.2),
    threeStarCount: Math.floor(normalizedTotal * 0.5),
    twoStarCount: Math.floor(normalizedTotal * 0.15),
    oneStarCount: Math.floor(normalizedTotal * 0.05),
  };

  let assigned =
    counts.fiveStarCount +
    counts.fourStarCount +
    counts.threeStarCount +
    counts.twoStarCount +
    counts.oneStarCount;

  while (assigned < normalizedTotal) {
    counts.threeStarCount += 1;
    assigned += 1;
  }

  return counts;
}

function normalizeRawScore(rawScore: number | null | undefined, bucketCount: number) {
  if (rawScore == null || Number.isNaN(rawScore)) return null;
  const rounded = Math.round(rawScore);
  return Math.min(bucketCount, Math.max(1, rounded));
}

function sortByScoreDescending<T extends { score: number | null; subjectId: string; sourceRecordId: string }>(rows: T[]) {
  return [...rows].sort((left, right) => {
    const leftScore = left.score ?? -Infinity;
    const rightScore = right.score ?? -Infinity;
    if (rightScore !== leftScore) return rightScore - leftScore;
    const subjectDiff = left.subjectId.localeCompare(right.subjectId, "zh-Hans-CN");
    if (subjectDiff !== 0) return subjectDiff;
    return left.sourceRecordId.localeCompare(right.sourceRecordId, "zh-Hans-CN");
  });
}

function assignBucketStars<T extends { score: number | null; subjectId: string; sourceRecordId: string }>(
  rows: T[],
) {
  const counts = buildTargetBucketCounts(rows.filter((row) => row.score != null).length);
  const sorted = sortByScoreDescending(rows).filter((row) => row.score != null);
  const assigned = sorted.map((row, index) => {
    const bucketIndex = index < counts.fiveStarCount
      ? 5
      : index < counts.fiveStarCount + counts.fourStarCount
        ? 4
        : index < counts.fiveStarCount + counts.fourStarCount + counts.threeStarCount
          ? 3
          : index < counts.fiveStarCount + counts.fourStarCount + counts.threeStarCount + counts.twoStarCount
            ? 2
            : 1;

    return {
      ...row,
      rankIndex: index + 1,
      stars: bucketIndex,
      bucketIndex,
    };
  });

  const unscored = rows.filter((row) => row.score == null).map((row) => ({
    ...row,
    rankIndex: null,
    stars: null,
    bucketIndex: null,
  }));

  return [...assigned, ...unscored] as Array<T & { rankIndex: number | null; stars: number | null; bucketIndex: number | null }>;
}

function summarizeBuckets<T extends { subjectName: string | null; subjectId: string; stars: number | null }>(
  rows: T[],
  bucketCount = 5,
): ManagerReviewBucketSummary[] {
  const buckets = buildEmptyBucketSummaries(normalizeTargetBucketCount(bucketCount));
  let counted = 0;

  for (const row of rows) {
    if (row.stars == null) continue;
    counted += 1;
    const bucket = buckets[row.stars - 1];
    bucket.count += 1;
    bucket.names.push(getDisplayName(row));
  }

  return finalizeBucketSummaries(buckets, counted);
}

function buildRaterBiasDeltaMap(raterRows: ManagerReviewRaterRecord[]) {
  const scoredRows = raterRows.filter((row) => row.score != null && !Number.isNaN(row.score));
  const overallAverage = average(scoredRows.map((row) => row.score));

  const grouped = new Map<string, ManagerReviewRaterRecord[]>();
  for (const row of raterRows) {
    const list = grouped.get(row.raterId) ?? [];
    list.push(row);
    grouped.set(row.raterId, list);
  }

  const rows: ManagerReviewRaterBiasRow[] = [...grouped.entries()]
    .map(([raterId, records]) => {
      const scorer = records.map((record) => record.score);
      const sampleCount = scorer.filter((value) => value != null && !Number.isNaN(value)).length;
      const averageScore = average(scorer);
      const offset = averageScore != null && overallAverage != null ? roundScore(averageScore - overallAverage) : null;
      const tendency: ManagerReviewRaterBiasRow["tendency"] = offset == null
        ? "正常"
        : offset > 0.3
          ? "偏高"
          : offset < -0.3
            ? "偏低"
            : "正常";

      return {
        raterId,
        raterName: records[0]?.raterName?.trim() || records[0]?.raterId,
        raterDepartment: records[0]?.raterDepartment?.trim() || null,
        sampleCount,
        averageScore,
        offset,
        tendency,
        isAbnormal: sampleCount >= 2 && offset != null && Math.abs(offset) >= 0.3,
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

  const biasMap = new Map<string, number>();
  for (const row of rows) {
    if (row.offset != null) {
      biasMap.set(row.raterId, row.offset);
    }
  }

  return { rows, biasMap, overallAverage };
}

function buildReviewerAdjustedRows(
  raterRows: ManagerReviewRaterRecord[],
  biasMap: Map<string, number>,
) {
  return raterRows.map((row) => {
    const bias = biasMap.get(row.raterId) ?? 0;
    const adjusted = row.score == null ? null : roundScore(Math.min(5, Math.max(1, row.score - bias)));

    return {
      ...row,
      reviewerBiasDelta: roundScore(bias),
      reviewerAdjustedScore: adjusted,
    };
  });
}

function buildSubjectLevelReviewerAdjustedRows(
  raterRows: ReturnType<typeof buildReviewerAdjustedRows>,
) {
  const grouped = new Map<string, typeof raterRows>();
  for (const row of raterRows) {
    const list = grouped.get(row.subjectId) ?? [];
    list.push(row);
    grouped.set(row.subjectId, list);
  }

  return [...grouped.entries()]
    .map(([subjectId, records]) => {
      const first = records[0];
      return {
        sourceRecordId: subjectId,
        subjectId,
        subjectName: first?.subjectName ?? null,
        subjectDepartment: getDepartment(first ?? { subjectDepartment: null }),
        score: average(records.map((record) => record.reviewerAdjustedScore)),
        rawScore: average(records.map((record) => record.score)),
        rawStars: normalizeRawScore(average(records.map((record) => record.score)), 5),
        reviewerBiasDelta: average(records.map((record) => record.reviewerBiasDelta)),
        reviewerAdjustedScore: average(records.map((record) => record.reviewerAdjustedScore)),
      } satisfies ReviewerAdjustedSubjectRecord;
    })
    .sort((left, right) => {
      const leftScore = left.reviewerAdjustedScore ?? left.rawScore ?? -Infinity;
      const rightScore = right.reviewerAdjustedScore ?? right.rawScore ?? -Infinity;
      if (rightScore !== leftScore) return rightScore - leftScore;
      return left.subjectId.localeCompare(right.subjectId, "zh-Hans-CN");
    });
}

function buildDepartmentNormalizedRows(subjectRows: ReviewerAdjustedSubjectRecord[]) {
  const grouped = new Map<string, ReviewerAdjustedSubjectRecord[]>();
  for (const row of subjectRows) {
    const key = getDepartment(row);
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const output: DepartmentNormalizedSubjectRecord[] = [];

  for (const [, rows] of grouped.entries()) {
    const assigned = assignBucketStars(rows);
    for (const row of assigned) {
      output.push({
        ...row,
        reviewerNormalizedStars: row.stars,
        reviewerRankIndex: row.rankIndex,
        departmentNormalizedStars: row.stars,
        departmentRankIndex: row.rankIndex,
      });
    }
  }

  return output.sort((left, right) => {
    const leftScore = left.reviewerAdjustedScore ?? left.rawScore ?? -Infinity;
    const rightScore = right.reviewerAdjustedScore ?? right.rawScore ?? -Infinity;
    if (rightScore !== leftScore) return rightScore - leftScore;
    return left.subjectId.localeCompare(right.subjectId, "zh-Hans-CN");
  });
}

function buildMovementRows(rows: DepartmentNormalizedSubjectRecord[]) {
  return rows
    .map((row) => {
      const rawDelta = (row.departmentNormalizedStars ?? 0) - (row.rawStars ?? 0);
      const movementLabel =
        row.departmentNormalizedStars == null || row.rawStars == null
          ? "待定"
          : rawDelta > 0
            ? "上调"
            : rawDelta < 0
              ? "下调"
              : "不变";

      return {
        sourceRecordId: row.sourceRecordId,
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        subjectDepartment: row.subjectDepartment,
        rawScore: row.rawScore,
        rawBucket: row.rawStars,
        reviewerBiasDelta: row.reviewerBiasDelta,
        reviewerAdjustedScore: row.reviewerAdjustedScore,
        reviewerNormalizedStars: row.reviewerNormalizedStars,
        reviewerRankIndex: row.reviewerRankIndex,
        departmentNormalizedStars: row.departmentNormalizedStars,
        departmentRankIndex: row.departmentRankIndex,
        movementLabel,
      } satisfies ManagerReviewMovementRow;
    })
    .sort((left, right) => {
      const leftDelta = Math.abs((left.departmentNormalizedStars ?? 0) - (left.rawBucket ?? 0));
      const rightDelta = Math.abs((right.departmentNormalizedStars ?? 0) - (right.rawBucket ?? 0));
      if (rightDelta !== leftDelta) return rightDelta - leftDelta;
      const leftScore = left.reviewerAdjustedScore ?? left.rawScore ?? -Infinity;
      const rightScore = right.reviewerAdjustedScore ?? right.rawScore ?? -Infinity;
      if (rightScore !== leftScore) return rightScore - leftScore;
      return left.subjectId.localeCompare(right.subjectId, "zh-Hans-CN");
    });
}

function countSkewedDepartments(subjectRows: ReviewerAdjustedSubjectRecord[]) {
  const scoredRows = subjectRows.filter((row) => row.reviewerAdjustedScore != null);
  if (scoredRows.length === 0) return 0;

  const overallAverage = average(scoredRows.map((row) => row.reviewerAdjustedScore));
  const grouped = new Map<string, ReviewerAdjustedSubjectRecord[]>();

  for (const row of scoredRows) {
    const key = getDepartment(row);
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  return [...grouped.values()].filter((rows) => {
    if (rows.length < 2) return false;
    const deptAverage = average(rows.map((row) => row.reviewerAdjustedScore));
    return deptAverage != null && overallAverage != null && Math.abs(deptAverage - overallAverage) >= 0.3;
  }).length;
}

function buildApplicationState(application: ManagerReviewNormalizationApplicationShape | null): ManagerReviewApplicationState {
  const workspaceState = application && application.revertedAt == null ? "STANDARDIZED" : "RAW";
  return {
    workspaceState,
    appliedAt: application ? application.appliedAt.toISOString() : null,
    revertedAt: application?.revertedAt ? application.revertedAt.toISOString() : null,
    snapshotId: application?.snapshotId ?? null,
    rollbackVisible: workspaceState === "STANDARDIZED",
  };
}

export function buildManagerReviewRawDistribution(subjectRecords: ManagerReviewSubjectRecord[], bucketCount = 5) {
  const buckets = buildEmptyBucketSummaries(normalizeTargetBucketCount(bucketCount));
  let counted = 0;

  for (const record of subjectRecords) {
    const bucketIndex = normalizeRawScore(record.score, buckets.length);
    if (bucketIndex == null) continue;
    counted += 1;
    const bucket = buckets[bucketIndex - 1];
    bucket.count += 1;
    bucket.names.push(getDisplayName(record));
  }

  return finalizeBucketSummaries(buckets, counted);
}

export function buildManagerReviewReviewerNormalizedDistribution(
  subjectRecords: ReviewerAdjustedSubjectRecord[],
  bucketCount = 5,
) {
  const assigned = assignBucketStars(
    subjectRecords.map((record) => ({
      ...record,
      score: record.reviewerAdjustedScore,
    })),
  );

  return summarizeBuckets(
    assigned.map((record) => ({
      subjectName: record.subjectName,
      subjectId: record.subjectId,
      stars: record.stars,
    })),
    bucketCount,
  );
}

export function buildManagerReviewDepartmentNormalizedDistribution(
  subjectRecords: DepartmentNormalizedSubjectRecord[],
  bucketCount = 5,
) {
  return summarizeBuckets(
    subjectRecords.map((record) => ({
      subjectName: record.subjectName,
      subjectId: record.subjectId,
      stars: record.departmentNormalizedStars,
    })),
    bucketCount,
  );
}

export function buildManagerReviewReviewerBiasRows(raterRecords: ManagerReviewRaterRecord[]) {
  return buildRaterBiasDeltaMap(raterRecords).rows;
}

export function buildManagerReviewMovementRows(raterRecords: ManagerReviewRaterRecord[]) {
  const bias = buildRaterBiasDeltaMap(raterRecords);
  const adjustedRows = buildReviewerAdjustedRows(raterRecords, bias.biasMap);
  const subjectRows = buildSubjectLevelReviewerAdjustedRows(adjustedRows);
  const departmentRows = buildDepartmentNormalizedRows(subjectRows);
  return buildMovementRows(departmentRows);
}

export function buildManagerReviewWorkspaceSummary(params: {
  subjectRecords: ManagerReviewSubjectRecord[];
  reviewerBiasRows: ManagerReviewRaterBiasRow[];
  movementRows: ManagerReviewMovementRow[];
  applicationState: ManagerReviewApplicationState;
}) {
  return {
    currentSourceCount: params.subjectRecords.length,
    abnormalReviewerCount: params.reviewerBiasRows.filter((row) => row.isAbnormal).length,
    shiftedPeopleCount: params.movementRows.filter((row) => (row.departmentNormalizedStars ?? 0) !== (row.rawBucket ?? 0)).length,
    skewedDepartmentCount: countSkewedDepartments(
      params.subjectRecords.map((record) => ({
        ...record,
        rawScore: record.score,
        rawStars: normalizeRawScore(record.score, 5),
        reviewerBiasDelta: null,
        reviewerAdjustedScore: record.score,
      })),
    ),
    workspaceState: params.applicationState.workspaceState,
  };
}

function buildReviewerNormalizedSubjectRows(
  subjectRecords: ManagerReviewSubjectRecord[],
  raterRecords: ManagerReviewRaterRecord[],
) {
  const bias = buildRaterBiasDeltaMap(raterRecords);
  const adjustedRaterRows = buildReviewerAdjustedRows(raterRecords, bias.biasMap);
  const grouped = new Map<string, typeof adjustedRaterRows>();

  for (const row of adjustedRaterRows) {
    const list = grouped.get(row.subjectId) ?? [];
    list.push(row);
    grouped.set(row.subjectId, list);
  }

  return subjectRecords
    .map((record) => {
      const records = grouped.get(record.subjectId) ?? [];
      const reviewerAdjustedScore = average(records.map((row) => row.reviewerAdjustedScore));
      const reviewerBiasDelta = average(records.map((row) => row.reviewerBiasDelta));

      return {
        ...record,
        rawScore: record.score,
        rawStars: normalizeRawScore(record.score, 5),
        reviewerBiasDelta,
        reviewerAdjustedScore,
      } satisfies ReviewerAdjustedSubjectRecord;
    })
    .sort((left, right) => {
      const leftScore = left.reviewerAdjustedScore ?? left.score ?? -Infinity;
      const rightScore = right.reviewerAdjustedScore ?? right.score ?? -Infinity;
      if (rightScore !== leftScore) return rightScore - leftScore;
      return left.subjectId.localeCompare(right.subjectId, "zh-Hans-CN");
    });
}

function buildDepartmentNormalizedSubjectRows(
  subjectRecords: ManagerReviewSubjectRecord[],
  raterRecords: ManagerReviewRaterRecord[],
) {
  const reviewerNormalizedRows = buildReviewerNormalizedSubjectRows(subjectRecords, raterRecords);
  return buildDepartmentNormalizedRows(reviewerNormalizedRows);
}

export function simulateManagerReviewNormalization(params: {
  cycleId: string;
  source?: ManagerReviewNormalizationSource;
  subjectRecords: ManagerReviewSubjectRecord[];
  raterRecords: ManagerReviewRaterRecord[];
  targetBucketCount?: number;
  strategy?: ManagerReviewNormalizationStrategy;
}) {
  const source = params.source ?? SUPERVISOR_EVAL_SOURCE;
  const targetBucketCount = normalizeTargetBucketCount(params.targetBucketCount);
  const reviewerNormalizedRows = buildReviewerNormalizedSubjectRows(params.subjectRecords, params.raterRecords);
  const departmentNormalizedRows = buildDepartmentNormalizedSubjectRows(params.subjectRecords, params.raterRecords);
  const entries = departmentNormalizedRows.map((row) => ({
    sourceRecordId: row.sourceRecordId,
    subjectId: row.subjectId,
    subjectName: row.subjectName,
    subjectDepartment: row.subjectDepartment,
    rawScore: row.score,
    rawStars: row.rawStars,
    reviewerBiasDelta: row.reviewerBiasDelta,
    reviewerAdjustedScore: row.reviewerAdjustedScore,
    reviewerNormalizedStars: row.reviewerNormalizedStars,
    reviewerRankIndex: row.reviewerRankIndex,
    departmentNormalizedStars: row.departmentNormalizedStars,
    departmentRankIndex: row.departmentRankIndex,
    movementLabel: row.departmentNormalizedStars == null || row.rawStars == null
      ? "待定"
      : row.departmentNormalizedStars > row.rawStars
        ? "上调"
        : row.departmentNormalizedStars < row.rawStars
          ? "下调"
          : "不变",
  })) satisfies ManagerReviewNormalizationEntryShape[];

  return {
    cycleId: params.cycleId,
    source,
    strategy: params.strategy ?? "REVIEWER_THEN_DEPARTMENT_BUCKET",
    targetBucketCount,
    rawRecordCount: params.subjectRecords.length,
    createdAt: new Date(),
    entries,
    rawDistribution: buildManagerReviewRawDistribution(params.subjectRecords, targetBucketCount),
    reviewerNormalizedDistribution: buildManagerReviewReviewerNormalizedDistribution(reviewerNormalizedRows, targetBucketCount),
    departmentNormalizedDistribution: buildManagerReviewDepartmentNormalizedDistribution(departmentNormalizedRows, targetBucketCount),
  } satisfies ManagerReviewNormalizationSnapshotShape;
}

export function buildManagerReviewApplicationRecord(params: {
  cycleId: string;
  source?: ManagerReviewNormalizationSource;
  snapshotId: string;
  appliedAt?: Date;
  revertedAt?: Date | null;
}): ManagerReviewNormalizationApplicationShape {
  return {
    cycleId: params.cycleId,
    source: params.source ?? SUPERVISOR_EVAL_SOURCE,
    snapshotId: params.snapshotId,
    appliedAt: params.appliedAt ?? new Date(),
    revertedAt: params.revertedAt ?? null,
  };
}

export function buildManagerReviewApplicationWhere(params: {
  cycleId: string;
  source?: ManagerReviewNormalizationSource;
}) {
  return {
    cycleId: params.cycleId,
    source: params.source ?? SUPERVISOR_EVAL_SOURCE,
  } as const;
}

export function buildManagerReviewWorkspacePayload(params: {
  cycleId: string;
  subjectRecords: ManagerReviewSubjectRecord[];
  raterRecords: ManagerReviewRaterRecord[];
  application?: ManagerReviewNormalizationApplicationShape | null;
  targetBucketCount?: number;
  strategy?: ManagerReviewNormalizationStrategy;
}): ManagerReviewWorkspacePayload {
  const snapshot = simulateManagerReviewNormalization({
    cycleId: params.cycleId,
    subjectRecords: params.subjectRecords,
    raterRecords: params.raterRecords,
    targetBucketCount: params.targetBucketCount,
    strategy: params.strategy,
  });
  const reviewerBiasRows = buildManagerReviewReviewerBiasRows(params.raterRecords);
  const movementRows = buildManagerReviewMovementRows(params.raterRecords);
  const applicationState = buildApplicationState(params.application ?? null);

  return {
    cycleId: snapshot.cycleId,
    source: snapshot.source,
    strategy: snapshot.strategy,
    targetBucketCount: snapshot.targetBucketCount,
    application: params.application ?? null,
    summary: {
      currentSourceCount: params.subjectRecords.length,
      abnormalReviewerCount: reviewerBiasRows.filter((row) => row.isAbnormal).length,
      shiftedPeopleCount: movementRows.filter((row) => (row.departmentNormalizedStars ?? 0) !== (row.rawBucket ?? 0)).length,
      skewedDepartmentCount: countSkewedDepartments(
        buildReviewerNormalizedSubjectRows(params.subjectRecords, params.raterRecords),
      ),
      workspaceState: applicationState.workspaceState,
    },
    rawDistribution: snapshot.rawDistribution,
    reviewerNormalizedDistribution: snapshot.reviewerNormalizedDistribution,
    departmentNormalizedDistribution: snapshot.departmentNormalizedDistribution,
    reviewerBiasRows,
    movementRows,
    applicationState,
  };
}

export function applyManagerReviewNormalizationLayer(params: {
  cycleId: string;
  snapshotId: string;
  subjectRecords: ManagerReviewSubjectRecord[];
  raterRecords: ManagerReviewRaterRecord[];
  application?: ManagerReviewNormalizationApplicationShape | null;
  targetBucketCount?: number;
  strategy?: ManagerReviewNormalizationStrategy;
  appliedAt?: Date;
}): ManagerReviewApplyResult {
  const snapshot = simulateManagerReviewNormalization({
    cycleId: params.cycleId,
    subjectRecords: params.subjectRecords,
    raterRecords: params.raterRecords,
    targetBucketCount: params.targetBucketCount,
    strategy: params.strategy,
  });
  const application =
    params.application ??
    buildManagerReviewApplicationRecord({
      cycleId: params.cycleId,
      snapshotId: params.snapshotId,
      appliedAt: params.appliedAt,
    });

  return {
    snapshot,
    application,
    payload: buildManagerReviewWorkspacePayload({
      cycleId: params.cycleId,
      subjectRecords: params.subjectRecords,
      raterRecords: params.raterRecords,
      application,
      targetBucketCount: params.targetBucketCount,
      strategy: params.strategy,
    }),
  };
}

export function revertManagerReviewNormalizationLayer(params: {
  cycleId: string;
  revertedAt?: Date;
}): ManagerReviewRevertResult {
  return {
    cycleId: params.cycleId,
    source: SUPERVISOR_EVAL_SOURCE,
    where: buildManagerReviewApplicationWhere({ cycleId: params.cycleId }),
    revertedAt: params.revertedAt ?? new Date(),
  };
}

export function getAppliedManagerReviewNormalizationMap(
  applications: ManagerReviewNormalizationApplicationShape[],
) {
  const map = new Map<string, ManagerReviewNormalizationApplicationShape>();
  for (const application of applications) {
    if (application.revertedAt) continue;
    map.set(`${application.cycleId}:${application.source}`, application);
  }
  return map;
}
