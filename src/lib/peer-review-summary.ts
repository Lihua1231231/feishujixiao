import {
  computeAbilityAverage,
  computeValuesAverage,
  roundToOneDecimal,
} from "@/lib/weighted-score";

export type PeerReviewScoreRecord = {
  outputScore?: number | null;
  collaborationScore?: number | null;
  valuesScore?: number | null;
  performanceStars?: number | null;
  performanceComment?: string | null;
  comprehensiveStars?: number | null;
  comprehensiveComment?: string | null;
  learningStars?: number | null;
  learningComment?: string | null;
  adaptabilityStars?: number | null;
  adaptabilityComment?: string | null;
  candidStars?: number | null;
  candidComment?: string | null;
  progressStars?: number | null;
  progressComment?: string | null;
  altruismStars?: number | null;
  altruismComment?: string | null;
  rootStars?: number | null;
  rootComment?: string | null;
  outputComment?: string | null;
  collaborationComment?: string | null;
  valuesComment?: string | null;
  innovationScore?: number | null;
  innovationComment?: string | null;
};

function isScore(value: number | null | undefined): value is number {
  return value !== null && value !== undefined;
}

function averageScores(scores: Array<number | null | undefined>) {
  const valid = scores.filter(isScore);
  if (valid.length === 0) return null;
  return roundToOneDecimal(valid.reduce((sum, score) => sum + score, 0) / valid.length);
}

function usesNewPeerReviewDimensions(review: PeerReviewScoreRecord) {
  return [
    review.performanceStars,
    review.comprehensiveStars,
    review.learningStars,
    review.adaptabilityStars,
    review.candidStars,
    review.progressStars,
    review.altruismStars,
    review.rootStars,
  ].some(isScore);
}

export function getPeerReviewPerformanceAverage(review: PeerReviewScoreRecord) {
  if (usesNewPeerReviewDimensions(review)) {
    return roundToOneDecimal(review.performanceStars ?? null);
  }
  return roundToOneDecimal(review.outputScore ?? null);
}

export function getPeerReviewAbilityAverage(review: PeerReviewScoreRecord) {
  if (usesNewPeerReviewDimensions(review)) {
    return computeAbilityAverage(
      review.comprehensiveStars ?? null,
      review.learningStars ?? null,
      review.adaptabilityStars ?? null,
    );
  }
  return roundToOneDecimal(review.collaborationScore ?? null);
}

export function getPeerReviewValuesAverage(review: PeerReviewScoreRecord) {
  if (usesNewPeerReviewDimensions(review)) {
    return computeValuesAverage(
      review.candidStars ?? null,
      review.progressStars ?? null,
      review.altruismStars ?? null,
      review.rootStars ?? null,
    );
  }
  return roundToOneDecimal(review.valuesScore ?? null);
}

function getPeerReviewOverallScores(review: PeerReviewScoreRecord) {
  if (usesNewPeerReviewDimensions(review)) {
    return [
      review.performanceStars,
      review.comprehensiveStars,
      review.learningStars,
      review.adaptabilityStars,
      review.candidStars,
      review.progressStars,
      review.altruismStars,
      review.rootStars,
    ];
  }

  return [review.outputScore, review.collaborationScore, review.valuesScore];
}

export function computePeerReviewAverageFromReviews(reviews: PeerReviewScoreRecord[]) {
  return averageScores(reviews.flatMap((review) => getPeerReviewOverallScores(review)));
}

export function buildPeerReviewCategorySummary(reviews: PeerReviewScoreRecord[]) {
  return {
    performance: averageScores(reviews.map((review) => getPeerReviewPerformanceAverage(review))),
    ability: averageScores(reviews.map((review) => getPeerReviewAbilityAverage(review))),
    values: averageScores(reviews.map((review) => getPeerReviewValuesAverage(review))),
    overall: computePeerReviewAverageFromReviews(reviews),
  };
}
