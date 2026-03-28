export type LogicReferenceStarRange = {
  stars: number;
  min: number;
  max: number;
};

export type LogicFinalReviewOpinionRecord = {
  reviewerId: string;
  decision: string;
  suggestedStars: number | null;
  reason: string;
  updatedAt?: Date;
};

export type LogicLeaderReviewRecord = {
  evaluatorId: string;
  weightedScore: number | null;
  status: string;
  submittedAt?: Date | null;
};

function roundToOneDecimal(value: number | null) {
  if (value == null) return null;
  return Math.round(value * 10) / 10;
}

function normalizeSummaryText(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : null;
}

function hasDimensionContent(value: string | null | undefined) {
  return Boolean(normalizeSummaryText(value));
}

function mapScoreToReferenceStars(score: number | null | undefined, ranges: LogicReferenceStarRange[]): number | null {
  if (score == null || Number.isNaN(score)) return null;
  const matched = ranges.find((range) => score >= range.min && score <= range.max);
  return matched?.stars ?? null;
}

function isLeaderFinalReviewReady(
  reviewerIds: string[],
  reviews: Array<{ evaluatorId: string; status: string }>,
) {
  if (reviewerIds.length !== 2) return false;
  const configuredEvaluatorIds = [...new Set(reviewerIds)];
  if (configuredEvaluatorIds.length !== 2) return false;

  const submittedEvaluatorIds = new Set(
    reviews.filter((item) => item.status === "SUBMITTED").map((item) => item.evaluatorId),
  );

  return configuredEvaluatorIds.every((evaluatorId) => submittedEvaluatorIds.has(evaluatorId));
}

export function resolveEmployeeConsensus(
  reviewerIds: string[],
  opinions: LogicFinalReviewOpinionRecord[],
) {
  const slots = reviewerIds.map((reviewerId) => opinions.find((item) => item.reviewerId === reviewerId) || null);
  const active = slots.filter((item): item is LogicFinalReviewOpinionRecord => Boolean(item && item.decision !== "PENDING"));
  const pendingCount = reviewerIds.length - active.length;
  const suggestedStars = active
    .map((item) => item.suggestedStars)
    .filter((value): value is number => value != null);
  const uniqueStars = [...new Set(suggestedStars)];
  const agreed = active.length === reviewerIds.length && uniqueStars.length === 1;
  const disagreed = active.length === reviewerIds.length && uniqueStars.length > 1;
  const officialStars = agreed ? uniqueStars[0] : null;

  return {
    agreed,
    disagreed,
    officialStars,
    pendingCount,
    handledCount: active.length,
  };
}

export function buildEmployeeConsensusReason(
  reviewerIds: string[],
  opinions: LogicFinalReviewOpinionRecord[],
  usersById: Map<string, { id: string; name: string }>,
  officialStars: number,
) {
  return reviewerIds
    .map((reviewerId) => {
      const opinion = opinions.find((item) => item.reviewerId === reviewerId);
      const reviewerName = usersById.get(reviewerId)?.name || reviewerId;
      if (!opinion || opinion.decision === "PENDING") {
        return `${reviewerName}：待处理`;
      }
      if (opinion.decision === "AGREE") {
        return `${reviewerName}：同意 ${officialStars} 星`;
      }
      return `${reviewerName}：改为 ${officialStars} 星${opinion.reason ? `（${opinion.reason}）` : ""}`;
    })
    .join("；");
}

export function resolveLeaderFinalDecision(
  reviewerIds: string[],
  reviews: LogicLeaderReviewRecord[],
  ranges: LogicReferenceStarRange[],
) {
  const submitted = reviews.filter((item) => item.status === "SUBMITTED" && reviewerIds.includes(item.evaluatorId));
  const ready = isLeaderFinalReviewReady(reviewerIds, reviews);
  if (!ready) {
    return {
      ready: false,
      combinedWeightedScore: null,
      officialStars: null,
    };
  }

  const weightedScores = submitted
    .map((item) => item.weightedScore)
    .filter((score): score is number => score != null);
  if (weightedScores.length !== reviewerIds.length) {
    return {
      ready: false,
      combinedWeightedScore: null,
      officialStars: null,
    };
  }

  const combinedWeightedScore = roundToOneDecimal(
    weightedScores.reduce((sum, score) => sum + score, 0) / weightedScores.length,
  );

  return {
    ready: true,
    combinedWeightedScore,
    officialStars: mapScoreToReferenceStars(combinedWeightedScore, ranges),
  };
}

export function buildDistributionComplianceChecks(
  distribution: Array<{
    stars: number;
    count: number;
    pct: number;
    exceeded: boolean;
    delta: number;
  }>,
) {
  return distribution.map((item) => ({
    stars: item.stars,
    label: `${item.stars}星`,
    target: item.stars === 3 ? "至少 50%" : `不超过 ${item.stars === 5 ? 10 : item.stars === 4 ? 20 : item.stars === 2 ? 15 : 5}%`,
    actualCount: item.count,
    actualPct: roundToOneDecimal(item.pct) ?? 0,
    compliant: !item.exceeded,
    deltaCount: item.delta,
    summary: item.exceeded
      ? `${item.stars}星${item.stars === 3 ? "不足" : "超出"}${item.delta}人`
      : `${item.stars}星符合建议分布`,
  }));
}

export function buildInitialDimensionChecks(
  rows: Array<{
    id: string;
    name: string;
    department: string;
    performanceStars: number | null;
    abilityStars: number | null;
    valuesStars: number | null;
    performanceComment: string;
    abilityComment: string;
    valuesComment: string;
  }>,
) {
  const items = rows.map((row) => {
    const missingDimensions: string[] = [];
    if (row.performanceStars == null || !hasDimensionContent(row.performanceComment)) missingDimensions.push("业绩产出结果");
    if (row.abilityStars == null || !hasDimensionContent(row.abilityComment)) missingDimensions.push("综合能力");
    if (row.valuesStars == null || !hasDimensionContent(row.valuesComment)) missingDimensions.push("价值观");

    return {
      employeeId: row.id,
      employeeName: row.name,
      department: row.department,
      missingDimensions,
      complete: missingDimensions.length === 0,
    };
  });

  return {
    totalCount: items.length,
    completeCount: items.filter((item) => item.complete).length,
    missingCount: items.filter((item) => !item.complete).length,
    items: items.filter((item) => !item.complete),
  };
}
