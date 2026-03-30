import { prisma } from "@/lib/db";
import {
  resolveDefaultCompanyFinalReviewerIds,
  resolveDefaultEmployeeSubjectIds,
} from "@/lib/final-review-defaults";
import {
  buildDistributionComplianceChecks,
  buildEmployeeConsensusReason,
  buildInitialDimensionChecks,
  resolveEmployeeConsensus,
  resolveLeaderFinalDecision,
} from "@/lib/final-review-logic";
import {
  buildPeerReviewCategorySummary,
  computePeerReviewAverageFromReviews,
  getPeerReviewAbilityAverage,
  getPeerReviewPerformanceAverage,
  getPeerReviewValuesAverage,
} from "@/lib/peer-review-summary";
import { getActiveCycle, type SessionUser } from "@/lib/session";
import { buildSupervisorAssignmentMap } from "@/lib/supervisor-assignments";
import { computeWeightedScore, computeWeightedScoreFromDimensions } from "@/lib/weighted-score";

export {
  buildDistributionComplianceChecks,
  buildEmployeeConsensusReason,
  buildInitialDimensionChecks,
  resolveEmployeeConsensus,
  resolveLeaderFinalDecision,
};

export type ReferenceStarRange = {
  stars: number;
  min: number;
  max: number;
};

export const DEFAULT_REFERENCE_STAR_RANGES: ReferenceStarRange[] = [
  { stars: 1, min: 0, max: 1.49 },
  { stars: 2, min: 1.5, max: 2.49 },
  { stars: 3, min: 2.5, max: 3.49 },
  { stars: 4, min: 3.5, max: 4.49 },
  { stars: 5, min: 4.5, max: 5 },
];

export type FinalReviewConfigValue = {
  cycleId: string;
  accessUserIds: string[];
  finalizerUserIds: string[];
  leaderEvaluatorUserIds: string[];
  leaderSubjectUserIds: string[];
  employeeSubjectUserIds: string[];
  referenceStarRanges: ReferenceStarRange[];
};

type WorkspaceConfigUsers = {
  id: string;
  name: string;
  department: string;
  role: string;
};

type DistributionEntry = {
  stars: number;
  count: number;
  pct: number;
  exceeded: boolean;
  delta: number;
  names: string[];
};

const DISTRIBUTION_LIMITS: Record<number, number> = {
  5: 10,
  4: 20,
  3: 50,
  2: 15,
  1: 5,
};

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseJsonRanges(raw: string | null | undefined): ReferenceStarRange[] {
  if (!raw) return DEFAULT_REFERENCE_STAR_RANGES;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_REFERENCE_STAR_RANGES;
    const ranges = parsed
      .map((item) => ({
        stars: Number(item?.stars),
        min: Number(item?.min),
        max: Number(item?.max),
      }))
      .filter((item) => Number.isFinite(item.stars) && Number.isFinite(item.min) && Number.isFinite(item.max))
      .sort((a, b) => a.stars - b.stars);

    return ranges.length === 5 ? ranges : DEFAULT_REFERENCE_STAR_RANGES;
  } catch {
    return DEFAULT_REFERENCE_STAR_RANGES;
  }
}

function dedupeIds(ids: string[]) {
  return [...new Set(ids.filter(Boolean))];
}

function resolveCompanyCalibratorIds(
  users: WorkspaceConfigUsers[],
  configuredIds: string[],
) {
  const defaultIds = resolveDefaultCompanyFinalReviewerIds(users);
  if (defaultIds.length === 2) return defaultIds;
  return dedupeIds(configuredIds).slice(0, 2);
}

export function serializeReferenceStarRanges(ranges: ReferenceStarRange[]): string {
  return JSON.stringify(
    ranges
      .map((range) => ({
        stars: Number(range.stars),
        min: Number(range.min),
        max: Number(range.max),
      }))
      .sort((a, b) => a.stars - b.stars)
  );
}

export function mapScoreToReferenceStars(score: number | null | undefined, ranges: ReferenceStarRange[]): number | null {
  if (score == null || Number.isNaN(score)) return null;
  const matched = ranges.find((range) => score >= range.min && score <= range.max);
  return matched?.stars ?? null;
}

export function computeSupervisorWeightedScore(
  performanceStars: number | null,
  abilityStars: number | null,
  valuesStars: number | null,
): number | null {
  return computeWeightedScore(performanceStars, abilityStars, valuesStars);
}

export function getFinalReviewConfigValue(
  cycleId: string,
  record?: {
    accessUserIds: string;
    finalizerUserIds: string;
    leaderEvaluatorUserIds: string;
    leaderSubjectUserIds: string;
    employeeSubjectUserIds?: string;
    referenceStarRanges: string;
  } | null,
  users: WorkspaceConfigUsers[] = [],
): FinalReviewConfigValue {
  const fallbackLeaderIds = users.filter((user) => user.role === "SUPERVISOR").map((user) => user.id);
  const parsedEmployeeSubjectUserIds = parseJsonArray(record?.employeeSubjectUserIds);
  const calibratorIds = resolveCompanyCalibratorIds(users, parseJsonArray(record?.finalizerUserIds));
  const configuredLeaderEvaluatorIds = parseJsonArray(record?.leaderEvaluatorUserIds);

  return {
    cycleId,
    accessUserIds: parseJsonArray(record?.accessUserIds),
    finalizerUserIds: calibratorIds,
    leaderEvaluatorUserIds: calibratorIds.length === 2
      ? calibratorIds
      : dedupeIds(configuredLeaderEvaluatorIds).slice(0, 2),
    leaderSubjectUserIds: parseJsonArray(record?.leaderSubjectUserIds).length > 0
      ? parseJsonArray(record?.leaderSubjectUserIds)
      : fallbackLeaderIds,
    employeeSubjectUserIds: parsedEmployeeSubjectUserIds.length > 0
      ? parsedEmployeeSubjectUserIds
      : resolveDefaultEmployeeSubjectIds(users),
    referenceStarRanges: parseJsonRanges(record?.referenceStarRanges),
  };
}

export function isOrdinaryEmployeeFinalReviewSubject(
  config: Pick<FinalReviewConfigValue, "employeeSubjectUserIds" | "leaderSubjectUserIds">,
  userId: string,
) {
  return config.employeeSubjectUserIds.includes(userId) && !config.leaderSubjectUserIds.includes(userId);
}

export function isLeaderFinalReviewReady(
  config: Pick<FinalReviewConfigValue, "leaderEvaluatorUserIds">,
  reviews: Array<{ evaluatorId: string; status: string }>,
) {
  if (config.leaderEvaluatorUserIds.length !== 2) return false;

  const configuredEvaluatorIds = [...new Set(config.leaderEvaluatorUserIds)];
  if (configuredEvaluatorIds.length !== 2) return false;

  const submittedEvaluatorIds = new Set(
    reviews.filter((item) => item.status === "SUBMITTED").map((item) => item.evaluatorId),
  );

  return configuredEvaluatorIds.every((evaluatorId) => submittedEvaluatorIds.has(evaluatorId));
}


export async function canAccessFinalReviewWorkspace(
  user: Pick<SessionUser, "id" | "role">,
  cycleId?: string | null,
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  const cycle = cycleId
    ? await prisma.reviewCycle.findUnique({ where: { id: cycleId } })
    : await getActiveCycle();
  if (!cycle) return false;

  const config = await prisma.finalReviewConfig.findUnique({
    where: { cycleId: cycle.id },
    select: { accessUserIds: true },
  });

  if (!config) return false;
  return parseJsonArray(config.accessUserIds).includes(user.id);
}

function roundToOneDecimal(value: number | null): number | null {
  if (value == null) return null;
  return Math.round(value * 10) / 10;
}

function normalizeSummaryText(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : null;
}

function formatSelfEvalStatus(selfEval: { status: string; importedAt: Date | null } | null): string {
  if (!selfEval) return "未导入";
  if (selfEval.status === "SUBMITTED") return "已提交";
  if (selfEval.importedAt || selfEval.status === "IMPORTED") return "已导入";
  if (selfEval.status === "DRAFT") return "草稿";
  return selfEval.status;
}

function buildValuesReviewComment(evaluation: {
  valuesComment: string;
  candidComment: string;
  progressComment: string;
  altruismComment: string;
  rootComment: string;
}) {
  const direct = normalizeSummaryText(evaluation.valuesComment);
  if (direct) return direct;

  const parts = [
    ["坦诚真实", normalizeSummaryText(evaluation.candidComment)],
    ["极致进取", normalizeSummaryText(evaluation.progressComment)],
    ["成就利他", normalizeSummaryText(evaluation.altruismComment)],
    ["ROOT", normalizeSummaryText(evaluation.rootComment)],
  ]
    .flatMap(([label, value]) => (value ? [`${label}：${value}`] : []))
    .filter((value): value is string => Boolean(value));

  return parts.join("；");
}

function combinePrefillComments(items: Array<{ label: string; comment: string | null | undefined }>) {
  return items
    .flatMap(({ label, comment }) => {
      const text = normalizeSummaryText(comment);
      return text ? [`${label}：${text}`] : [];
    })
    .join("\n");
}

type OpinionPrefillDraft = {
  decision: "AGREE" | "OVERRIDE";
  suggestedStars: number | null;
  reason: string;
  sourceLabel: string;
};

function buildOpinionPrefillFromSupervisorEval(
  evaluation: {
    performanceComment: string;
    abilityComment: string;
    valuesComment: string;
    candidComment: string;
    progressComment: string;
    altruismComment: string;
    rootComment: string;
    weightedScore: number | null;
  },
  referenceStars: number | null,
  ranges: ReferenceStarRange[],
): OpinionPrefillDraft | null {
  const suggestedStars = mapScoreToReferenceStars(
    evaluation.weightedScore != null ? Number(evaluation.weightedScore) : null,
    ranges,
  );
  if (suggestedStars == null) return null;

  const summary =
    combinePrefillComments([
      { label: "业绩产出", comment: evaluation.performanceComment },
      { label: "综合能力", comment: evaluation.abilityComment },
      { label: "价值观", comment: buildValuesReviewComment(evaluation) },
    ]) || "这份直属上级绩效初评未填写可复用评语，请按实际情况补充。";

  return {
    decision: referenceStars != null && suggestedStars === referenceStars ? "AGREE" : "OVERRIDE",
    suggestedStars,
    reason: `自动预填自你已提交的直属上级绩效初评。\n${summary}`,
    sourceLabel: "已提交的直属上级绩效初评",
  };
}

function buildOpinionPrefillFromPeerReview(
  review: {
    performanceStars: number | null;
    comprehensiveStars: number | null;
    learningStars: number | null;
    adaptabilityStars: number | null;
    candidStars: number | null;
    progressStars: number | null;
    altruismStars: number | null;
    rootStars: number | null;
    performanceComment: string;
    comprehensiveComment: string;
    learningComment: string;
    adaptabilityComment: string;
    candidComment: string;
    progressComment: string;
    altruismComment: string;
    rootComment: string;
    innovationComment: string | null;
  },
  referenceStars: number | null,
  ranges: ReferenceStarRange[],
): OpinionPrefillDraft | null {
  const weightedScore = computeWeightedScoreFromDimensions({
    performanceStars: review.performanceStars,
    comprehensiveStars: review.comprehensiveStars,
    learningStars: review.learningStars,
    adaptabilityStars: review.adaptabilityStars,
    candidStars: review.candidStars,
    progressStars: review.progressStars,
    altruismStars: review.altruismStars,
    rootStars: review.rootStars,
  });
  const suggestedStars = mapScoreToReferenceStars(weightedScore, ranges);
  if (suggestedStars == null) return null;

  const summary =
    combinePrefillComments([
      { label: "业绩产出", comment: review.performanceComment },
      { label: "综合能力", comment: review.comprehensiveComment },
      { label: "学习能力", comment: review.learningComment },
      { label: "适应能力", comment: review.adaptabilityComment },
      { label: "坦诚真实", comment: review.candidComment },
      { label: "极致进取", comment: review.progressComment },
      { label: "成就利他", comment: review.altruismComment },
      { label: "ROOT", comment: review.rootComment },
      { label: "其他补充", comment: review.innovationComment },
    ]) || "这份360环评未填写可复用评语，请按实际情况补充。";

  return {
    decision: referenceStars != null && suggestedStars === referenceStars ? "AGREE" : "OVERRIDE",
    suggestedStars,
    reason: `自动预填自你已提交的360环评。\n${summary}`,
    sourceLabel: "已提交的360环评",
  };
}

function resolveEmployeeOpinionPrefill(args: {
  reviewerId: string;
  employeeId: string;
  referenceStars: number | null;
  ranges: ReferenceStarRange[];
  supervisorEvals: Array<{
    employeeId: string;
    evaluatorId: string;
    status: string;
    performanceComment: string;
    abilityComment: string;
    valuesComment: string;
    candidComment: string;
    progressComment: string;
    altruismComment: string;
    rootComment: string;
    weightedScore: number | null;
  }>;
  peerReviews: Array<{
    revieweeId: string;
    reviewerId: string;
    performanceStars: number | null;
    comprehensiveStars: number | null;
    learningStars: number | null;
    adaptabilityStars: number | null;
    candidStars: number | null;
    progressStars: number | null;
    altruismStars: number | null;
    rootStars: number | null;
    performanceComment: string;
    comprehensiveComment: string;
    learningComment: string;
    adaptabilityComment: string;
    candidComment: string;
    progressComment: string;
    altruismComment: string;
    rootComment: string;
    innovationComment: string | null;
  }>;
}): OpinionPrefillDraft | null {
  const submittedSupervisorEval = args.supervisorEvals.find((item) =>
    item.employeeId === args.employeeId
    && item.evaluatorId === args.reviewerId
    && item.status === "SUBMITTED",
  );
  if (submittedSupervisorEval) {
    return buildOpinionPrefillFromSupervisorEval(
      submittedSupervisorEval,
      args.referenceStars,
      args.ranges,
    );
  }

  const submittedPeerReview = args.peerReviews.find((item) =>
    item.revieweeId === args.employeeId
    && item.reviewerId === args.reviewerId,
  );
  if (submittedPeerReview) {
    return buildOpinionPrefillFromPeerReview(
      submittedPeerReview,
      args.referenceStars,
      args.ranges,
    );
  }

  return null;
}

function getWeightedScoreSpread(scores: Array<number | null | undefined>): number | null {
  const validScores = scores.filter((score): score is number => score != null);
  if (validScores.length < 2) return null;
  return roundToOneDecimal(Math.max(...validScores) - Math.min(...validScores));
}

function getLatestConfirmationMap(confirmations: Array<{
  userId: string;
  scope: string;
  officialStars: number;
  reason: string;
  confirmerId: string;
  createdAt: Date;
}>) {
  const latest = new Map<string, {
    userId: string;
    scope: string;
    officialStars: number;
    reason: string;
    confirmerId: string;
    createdAt: Date;
  }>();

  for (const confirmation of confirmations) {
    const key = `${confirmation.scope}:${confirmation.userId}`;
    const current = latest.get(key);
    if (!current || confirmation.createdAt > current.createdAt) {
      latest.set(key, confirmation);
    }
  }

  return latest;
}

function buildDistribution(
  rows: Array<{ name: string; stars: number | null }>,
): DistributionEntry[] {
  const total = rows.filter((row) => row.stars != null).length;

  return [1, 2, 3, 4, 5].map((stars) => {
    const matched = rows.filter((row) => row.stars === stars);
    const count = matched.length;
    const pct = total > 0 ? (count / total) * 100 : 0;
    const limit = DISTRIBUTION_LIMITS[stars];
    const exceeded = stars === 3 ? pct < limit : pct > limit;
    const rawDelta = stars === 3
      ? Math.ceil((limit / 100) * total) - count
      : count - Math.floor((limit / 100) * total);

    return {
      stars,
      count,
      pct,
      exceeded,
      delta: exceeded ? Math.max(0, rawDelta) : 0,
      names: matched.map((item) => item.name),
    };
  });
}

function pickOpinionStatusMeta(decision: string, suggestedStars: number | null) {
  if (decision === "AGREE") {
    return { label: "已同意", tone: "success", suggestedStars };
  }
  if (decision === "OVERRIDE") {
    return { label: "已更改", tone: "warning", suggestedStars };
  }
  return { label: "待处理", tone: "muted", suggestedStars: null };
}

function buildOpinionSummary(opinions: Array<{ decision: string }>) {
  return [
    { label: "待处理", count: opinions.filter((item) => item.decision === "PENDING").length },
    { label: "同意参考星级", count: opinions.filter((item) => item.decision === "AGREE").length },
    { label: "主张改星", count: opinions.filter((item) => item.decision === "OVERRIDE").length },
  ];
}

function buildLeaderEvaluatorProgress(
  evaluatorIds: string[],
  usersById: Map<string, { id: string; name: string; department: string; role: string }>,
  leaderReviews: Array<{ evaluatorId: string; status: string }>,
  canViewLeaderEvaluationDetails: boolean,
) {
  return evaluatorIds.map((evaluatorId, index) => ({
    evaluatorId,
    evaluatorName: canViewLeaderEvaluationDetails ? usersById.get(evaluatorId)?.name || evaluatorId : `第${index + 1}位填写人`,
    submittedCount: leaderReviews.filter((review) => review.evaluatorId === evaluatorId && review.status === "SUBMITTED").length,
  }));
}

const NAMED_PEER_REVIEW_VIEWER_NAMES = new Set(["吴承霖", "邱翔", "禹聪琪"]);

export async function buildFinalReviewWorkspacePayload(user: SessionUser) {
  const cycle = await getActiveCycle();
  if (!cycle) {
    return {
      cycle: null,
      canAccess: user.role === "ADMIN",
      config: null,
      overview: null,
      employeeReview: null,
      leaderReview: null,
    };
  }

  const [reviewUsers, directoryUsers] = await Promise.all([
    prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      select: {
        id: true,
        name: true,
        department: true,
        jobTitle: true,
        role: true,
        supervisorId: true,
        supervisor: { select: { id: true, name: true } },
      },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        department: true,
        role: true,
      },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    }),
  ]);

  const configRecord = await prisma.finalReviewConfig.findUnique({
    where: { cycleId: cycle.id },
  });
  const config = getFinalReviewConfigValue(cycle.id, configRecord, directoryUsers);
  const canAccess = await canAccessFinalReviewWorkspace(user, cycle.id);
  if (!canAccess) {
    return {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        status: cycle.status,
        calibrationStart: cycle.calibrationStart.toISOString(),
        calibrationEnd: cycle.calibrationEnd.toISOString(),
      },
      canAccess: false,
      config,
      overview: null,
      employeeReview: null,
      leaderReview: null,
    };
  }

  const [allSupervisorEvals, selfEvals, peerReviews, opinions, leaderReviews, confirmations] = await Promise.all([
    prisma.supervisorEval.findMany({
      where: { cycleId: cycle.id },
      select: {
        employeeId: true,
        evaluatorId: true,
        performanceStars: true,
        weightedScore: true,
        status: true,
        abilityStars: true,
        comprehensiveStars: true,
        learningStars: true,
        adaptabilityStars: true,
        valuesStars: true,
        performanceComment: true,
        abilityComment: true,
        valuesComment: true,
        candidStars: true,
        candidComment: true,
        progressStars: true,
        progressComment: true,
        altruismStars: true,
        altruismComment: true,
        rootStars: true,
        rootComment: true,
        evaluator: { select: { id: true, name: true } },
      },
    }),
    prisma.selfEvaluation.findMany({
      where: { cycleId: cycle.id },
      select: { userId: true, status: true, importedAt: true, sourceUrl: true },
    }),
    prisma.peerReview.findMany({
      where: { cycleId: cycle.id, status: "SUBMITTED" },
      select: {
        revieweeId: true,
        reviewerId: true,
        reviewer: { select: { name: true } },
        outputScore: true,
        outputComment: true,
        collaborationScore: true,
        collaborationComment: true,
        valuesScore: true,
        valuesComment: true,
        innovationScore: true,
        innovationComment: true,
        performanceStars: true,
        performanceComment: true,
        comprehensiveStars: true,
        comprehensiveComment: true,
        learningStars: true,
        learningComment: true,
        adaptabilityStars: true,
        adaptabilityComment: true,
        candidStars: true,
        candidComment: true,
        progressStars: true,
        progressComment: true,
        altruismStars: true,
        altruismComment: true,
        rootStars: true,
        rootComment: true,
      },
    }),
    prisma.finalReviewOpinion.findMany({
      where: { cycleId: cycle.id },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.leaderFinalReview.findMany({
      where: { cycleId: cycle.id },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.finalReviewConfirmation.findMany({
      where: { cycleId: cycle.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const usersById = new Map(directoryUsers.map((item) => [item.id, item]));
  const configUsers = {
    accessUsers: config.accessUserIds.map((id) => usersById.get(id)).filter(Boolean),
    finalizers: config.finalizerUserIds.map((id) => usersById.get(id)).filter(Boolean),
    leaderEvaluators: config.leaderEvaluatorUserIds.map((id) => usersById.get(id)).filter(Boolean),
    leaderSubjects: config.leaderSubjectUserIds.map((id) => usersById.get(id)).filter(Boolean),
  };

  const assignments = buildSupervisorAssignmentMap(
    reviewUsers.map((item) => ({
      id: item.id,
      name: item.name,
      supervisorId: item.supervisorId,
      supervisor: item.supervisor,
    })),
    allSupervisorEvals.map((item) => ({
      employeeId: item.employeeId,
      evaluatorId: item.evaluatorId,
      evaluatorName: item.evaluator.name,
    })),
  );

  const selfEvalMap = new Map(selfEvals.map((item) => [item.userId, item]));
  const latestConfirmationMap = getLatestConfirmationMap(confirmations);
  const canViewNamedPeerReviewers = NAMED_PEER_REVIEW_VIEWER_NAMES.has(user.name);

  const opinionsByEmployee = new Map<string, typeof opinions>();
  for (const opinion of opinions) {
    const current = opinionsByEmployee.get(opinion.employeeId) || [];
    current.push(opinion);
    opinionsByEmployee.set(opinion.employeeId, current);
  }

  const leaderReviewsByEmployee = new Map<string, typeof leaderReviews>();
  for (const review of leaderReviews) {
    const current = leaderReviewsByEmployee.get(review.employeeId) || [];
    current.push(review);
    leaderReviewsByEmployee.set(review.employeeId, current);
  }

  const peerReviewAverageByEmployee = new Map<string, number>();
  const peerReviewSummaryByEmployee = new Map<string, {
    overall: number | null;
    performance: number | null;
    ability: number | null;
    values: number | null;
    count: number;
    reviews: Array<{
      reviewerName: string;
      performanceStars: number | null;
      performanceComment: string;
      abilityAverage: number | null;
      comprehensiveStars: number | null;
      comprehensiveComment: string;
      learningStars: number | null;
      learningComment: string;
      adaptabilityStars: number | null;
      adaptabilityComment: string;
      valuesAverage: number | null;
      candidStars: number | null;
      candidComment: string;
      progressStars: number | null;
      progressComment: string;
      altruismStars: number | null;
      altruismComment: string;
      rootStars: number | null;
      rootComment: string;
      innovationScore: number | null;
      innovationComment: string;
    }>;
  }>();
  const peerReviewGroups = new Map<string, typeof peerReviews>();
  for (const review of peerReviews) {
    const current = peerReviewGroups.get(review.revieweeId) || [];
    current.push(review);
    peerReviewGroups.set(review.revieweeId, current);
  }
  for (const [employeeId, reviews] of peerReviewGroups.entries()) {
    const average = computePeerReviewAverageFromReviews(reviews);
    if (average != null) {
      peerReviewAverageByEmployee.set(employeeId, average);
    }
    const categorySummary = buildPeerReviewCategorySummary(reviews);
    peerReviewSummaryByEmployee.set(employeeId, {
      overall: categorySummary.overall,
      performance: categorySummary.performance,
      ability: categorySummary.ability,
      values: categorySummary.values,
      count: reviews.length,
      reviews: reviews.map((review, index) => ({
        reviewerName: canViewNamedPeerReviewers
          ? review.reviewer?.name || "未配置"
          : `匿名反馈 ${index + 1}`,
        performanceStars: getPeerReviewPerformanceAverage(review),
        performanceComment: review.performanceComment || review.outputComment || "",
        abilityAverage: getPeerReviewAbilityAverage(review),
        comprehensiveStars: review.comprehensiveStars ?? null,
        comprehensiveComment: review.comprehensiveComment || "",
        learningStars: review.learningStars ?? null,
        learningComment: review.learningComment || "",
        adaptabilityStars: review.adaptabilityStars ?? null,
        adaptabilityComment: review.adaptabilityComment || "",
        valuesAverage: getPeerReviewValuesAverage(review),
        candidStars: review.candidStars ?? null,
        candidComment: review.candidComment || "",
        progressStars: review.progressStars ?? null,
        progressComment: review.progressComment || "",
        altruismStars: review.altruismStars ?? null,
        altruismComment: review.altruismComment || "",
        rootStars: review.rootStars ?? null,
        rootComment: review.rootComment || "",
        innovationScore: review.innovationScore ?? null,
        innovationComment: review.innovationComment || "",
      })),
    });
  }

  const leaderSubjectIds = new Set(config.leaderSubjectUserIds);
  const employeeSubjectIds = new Set(config.employeeSubjectUserIds);
  const employeeUsers = reviewUsers.filter((item) =>
    employeeSubjectIds.has(item.id) && !leaderSubjectIds.has(item.id),
  );
  const leaderUsers = reviewUsers.filter((item) => leaderSubjectIds.has(item.id));
  const employeeOpinionActorIds = [...new Set(config.finalizerUserIds)].slice(0, 2);
  const isCompanyCalibrator = employeeOpinionActorIds.includes(user.id);
  const canSubmitOpinion = isCompanyCalibrator;
  const canViewOpinionDetails = user.role === "ADMIN" || isCompanyCalibrator;
  const canViewLeaderEvaluationDetails =
    user.role === "ADMIN" || isCompanyCalibrator || config.leaderEvaluatorUserIds.includes(user.id);

  const employeeRows = employeeUsers.map((employee) => {
    const assignment = assignments.get(employee.id);
    const currentEvals = allSupervisorEvals.filter((item) =>
      item.employeeId === employee.id
      && Boolean(assignment?.currentEvaluatorIds.includes(item.evaluatorId)),
    );
    const scoredCurrentEvals = currentEvals.filter((item) => item.weightedScore != null);
    const weightedScore = scoredCurrentEvals.length > 0
      ? roundToOneDecimal(scoredCurrentEvals.reduce((sum, item) => sum + Number(item.weightedScore), 0) / scoredCurrentEvals.length)
      : null;
    const referenceStars = mapScoreToReferenceStars(weightedScore, config.referenceStarRanges);
    const employeeOpinions = (opinionsByEmployee.get(employee.id) || []).filter((item) =>
      employeeOpinionActorIds.includes(item.reviewerId),
    );
    const consensus = resolveEmployeeConsensus(employeeOpinionActorIds, employeeOpinions);
    const latestConfirmation = latestConfirmationMap.get(`EMPLOYEE:${employee.id}`);
    const handledCount = consensus.handledCount;
    const officialStars = consensus.officialStars;
    const currentStars = officialStars ?? referenceStars;
    const overrideOpinionCount = employeeOpinions.filter((item) => item.decision === "OVERRIDE").length;
    const pendingOpinionCount = consensus.pendingCount;
    const scoreSpread = getWeightedScoreSpread(currentEvals.map((item) => item.weightedScore != null ? Number(item.weightedScore) : null));
    const opinionCards = employeeOpinionActorIds.map((reviewerId) => {
      const reviewer = usersById.get(reviewerId);
      const savedOpinion = employeeOpinions.find((item) => item.reviewerId === reviewerId);
      const prefill = reviewerId === user.id && (!savedOpinion || savedOpinion.decision === "PENDING")
        ? resolveEmployeeOpinionPrefill({
          reviewerId,
          employeeId: employee.id,
          referenceStars,
          ranges: config.referenceStarRanges,
          supervisorEvals: allSupervisorEvals,
          peerReviews,
        })
        : null;
      const meta = pickOpinionStatusMeta(savedOpinion?.decision || "PENDING", savedOpinion?.suggestedStars ?? referenceStars);
      return {
        reviewerId,
        reviewerName: reviewer?.name || "未配置",
        decision: savedOpinion?.decision || "PENDING",
        decisionLabel: meta.label,
        suggestedStars: savedOpinion?.suggestedStars ?? meta.suggestedStars,
        reason: canViewOpinionDetails ? savedOpinion?.reason || "" : "",
        isMine: reviewerId === user.id,
        hasSavedOpinion: Boolean(savedOpinion && savedOpinion.decision !== "PENDING"),
        prefillDecision: prefill?.decision || null,
        prefillSuggestedStars: prefill?.suggestedStars ?? null,
        prefillReason: reviewerId === user.id ? prefill?.reason || "" : "",
        prefillSourceLabel: reviewerId === user.id ? prefill?.sourceLabel || null : null,
        updatedAt: savedOpinion?.updatedAt?.toISOString() || null,
      };
    });

    const anomalyTags: string[] = [];
    if (consensus.disagreed) anomalyTags.push("两位校准人结论不一致");
    if (overrideOpinionCount > 0) anomalyTags.push("存在改星意见");
    if (scoreSpread != null && scoreSpread >= 1) anomalyTags.push("初评分差较大");
    if (officialStars != null && referenceStars != null && officialStars !== referenceStars) anomalyTags.push("已拍板改星");
    const officialReason = officialStars != null
      ? latestConfirmation?.officialStars === officialStars
        ? latestConfirmation.reason
        : buildEmployeeConsensusReason(employeeOpinionActorIds, employeeOpinions, usersById, officialStars)
      : "";

    return {
      id: employee.id,
      name: employee.name,
      department: employee.department,
      jobTitle: employee.jobTitle,
      weightedScore,
      referenceStars,
      referenceSourceLabel:
        "加权总分 = 业绩产出×50% + 个人能力均分（综合能力/学习能力/适应能力）×30% + 价值观均分（坦诚真实/极致进取/成就利他/ROOT）×20%，再按区间换算参考星级。",
      officialStars,
      officialReason,
      officialConfirmedAt: officialStars != null && latestConfirmation?.officialStars === officialStars
        ? latestConfirmation.createdAt.toISOString()
        : null,
      agreementState: consensus.agreed ? "AGREED" : consensus.disagreed ? "DISAGREED" : "PENDING",
      canSubmitOpinion,
      canViewOpinionDetails,
      canViewNamedPeerReviewers,
      currentEvaluatorNames: assignment?.currentEvaluatorNames || [],
      currentEvaluatorStatuses: currentEvals.map((item) => ({
        evaluatorId: item.evaluatorId,
        evaluatorName: item.evaluator.name,
        status: item.status,
        weightedScore: item.weightedScore != null ? Number(item.weightedScore) : null,
      })),
      selfEvalStatus: formatSelfEvalStatus(selfEvalMap.get(employee.id) ?? null),
      selfEvalSourceUrl: selfEvalMap.get(employee.id)?.sourceUrl || null,
      peerAverage: peerReviewAverageByEmployee.get(employee.id) ?? null,
      peerReviewSummary: peerReviewSummaryByEmployee.get(employee.id) ?? null,
      initialReviewDetails: currentEvals.map((item) => ({
        evaluatorId: item.evaluatorId,
        evaluatorName: item.evaluator.name,
        status: item.status,
        weightedScore: item.weightedScore != null ? Number(item.weightedScore) : null,
        performanceStars: item.performanceStars ?? null,
        performanceComment: item.performanceComment || "",
        abilityStars: item.abilityStars ?? null,
        abilityComment: item.abilityComment || "",
        abilityBreakdown: [
          { label: "综合能力", stars: item.comprehensiveStars ?? null },
          { label: "学习能力", stars: item.learningStars ?? null },
          { label: "适应能力", stars: item.adaptabilityStars ?? null },
        ],
        valuesStars: item.valuesStars ?? null,
        valuesComment: buildValuesReviewComment(item),
        valuesBreakdown: [
          {
            label: "坦诚真实",
            stars: item.candidStars ?? null,
            comment: item.candidComment || "",
          },
          {
            label: "极致进取",
            stars: item.progressStars ?? null,
            comment: item.progressComment || "",
          },
          {
            label: "成就利他",
            stars: item.altruismStars ?? null,
            comment: item.altruismComment || "",
          },
          {
            label: "ROOT",
            stars: item.rootStars ?? null,
            comment: item.rootComment || "",
          },
        ],
      })),
      handledCount,
      totalReviewerCount: employeeOpinionActorIds.length,
      summaryStats: {
        handledCount,
        totalReviewerCount: employeeOpinionActorIds.length,
        pendingCount: pendingOpinionCount,
        overrideCount: overrideOpinionCount,
        disagreementCount: consensus.disagreed ? 1 : 0,
      },
      opinionSummary: buildOpinionSummary(opinionCards.map((opinion) => ({ decision: opinion.decision }))),
      anomalyTags,
      opinions: opinionCards,
      distributionStars: currentStars,
    };
  });

  const departmentDistributions = [...new Set(employeeRows.map((item) => item.department).filter(Boolean))].map((department) => {
    const rows = employeeRows.filter((item) => item.department === department);
    return {
      department,
      total: rows.length,
      distribution: buildDistribution(rows.map((item) => ({ name: item.name, stars: item.distributionStars }))),
    };
  });

  const employeeDistribution = buildDistribution(employeeRows.map((item) => ({ name: item.name, stars: item.distributionStars })));

  const leaderRows = leaderUsers.map((leader) => {
    const leaderEvalRows = leaderReviewsByEmployee.get(leader.id) || [];
    const evaluations = config.leaderEvaluatorUserIds.map((evaluatorId) => {
      const evaluator = usersById.get(evaluatorId);
      const existing = leaderEvalRows.find((item) => item.evaluatorId === evaluatorId) || null;
      return {
        evaluatorId,
        evaluatorName: evaluator?.name || "未配置",
        status: existing?.status || "DRAFT",
        weightedScore: existing?.weightedScore != null ? Number(existing.weightedScore) : null,
        editable: evaluatorId === user.id,
        submittedAt: existing?.submittedAt?.toISOString() || null,
        referenceStars: mapScoreToReferenceStars(existing?.weightedScore != null ? Number(existing.weightedScore) : null, config.referenceStarRanges),
        form: {
          performanceStars: existing?.performanceStars ?? null,
          performanceComment: existing?.performanceComment ?? "",
          abilityStars: existing?.abilityStars ?? null,
          abilityComment: existing?.abilityComment ?? "",
          comprehensiveStars: existing?.comprehensiveStars ?? null,
          learningStars: existing?.learningStars ?? null,
          adaptabilityStars: existing?.adaptabilityStars ?? null,
          valuesStars: existing?.valuesStars ?? null,
          valuesComment: existing?.valuesComment ?? "",
          candidStars: existing?.candidStars ?? null,
          candidComment: existing?.candidComment ?? "",
          progressStars: existing?.progressStars ?? null,
          progressComment: existing?.progressComment ?? "",
          altruismStars: existing?.altruismStars ?? null,
          altruismComment: existing?.altruismComment ?? "",
          rootStars: existing?.rootStars ?? null,
          rootComment: existing?.rootComment ?? "",
        },
      };
    });
    const submittedCount = evaluations.filter((item) => item.status === "SUBMITTED").length;
    const finalDecision = resolveLeaderFinalDecision(
      config.leaderEvaluatorUserIds,
      evaluations.map((item) => ({
        evaluatorId: item.evaluatorId,
        weightedScore: item.weightedScore,
        status: item.status,
      })),
      config.referenceStarRanges,
    );
    const latestConfirmation = latestConfirmationMap.get(`LEADER:${leader.id}`);
    const officialReason = finalDecision.officialStars != null
      ? latestConfirmation?.officialStars === finalDecision.officialStars
        ? latestConfirmation.reason
        : evaluations
          .map((item) => `${item.evaluatorName} ${item.weightedScore?.toFixed(1) ?? "—"} 分 / ${item.referenceStars ?? "—"} 星`)
          .join("；")
      : "";

    return {
      id: leader.id,
      name: leader.name,
      department: leader.department,
      jobTitle: leader.jobTitle,
      officialStars: finalDecision.officialStars,
      officialReason,
      officialConfirmedAt: finalDecision.officialStars != null && latestConfirmation?.officialStars === finalDecision.officialStars
        ? latestConfirmation.createdAt.toISOString()
        : null,
      canViewLeaderEvaluationDetails,
      submissionSummary: {
        configuredEvaluatorCount: config.leaderEvaluatorUserIds.length,
        submittedCount,
        pendingCount: Math.max(config.leaderEvaluatorUserIds.length - submittedCount, 0),
      },
      evaluations: canViewLeaderEvaluationDetails ? evaluations.map((evaluation) => ({
        ...evaluation,
        form: evaluation.form,
      })) : [],
      combinedWeightedScore: finalDecision.combinedWeightedScore,
      combinedReferenceStars: finalDecision.officialStars,
      bothSubmitted: finalDecision.ready,
    };
  });

  const companyPeople = [...employeeRows, ...leaderRows].map((item) => ({
    name: item.name,
    officialStars: item.officialStars,
    referenceStars: "referenceStars" in item ? item.referenceStars : null,
  }));
  const leaderDistribution = buildDistribution(
    leaderRows.map((item) => ({ name: item.name, stars: item.officialStars })),
  );
  const mergedDistribution = buildDistribution(
    [
      ...employeeRows.map((item) => ({ name: item.name, stars: item.officialStars ?? item.referenceStars })),
      ...leaderRows.map((item) => ({ name: item.name, stars: item.officialStars })),
    ],
  );
  const employeeOnlyDistribution = buildDistribution(
    employeeRows.map((item) => ({ name: item.name, stars: item.officialStars ?? item.referenceStars })),
  );

  const assignmentEmployeeIds = employeeUsers
    .filter((item) => assignments.has(item.id))
    .map((item) => item.id);
  const submittedEmployeeCount = assignmentEmployeeIds.filter((employeeId) => {
    const assignment = assignments.get(employeeId);
    const currentEvalIds = assignment?.currentEvaluatorIds || [];
    return currentEvalIds.length > 0
      && currentEvalIds.every((evaluatorId) => {
        const existing = allSupervisorEvals.find((item) => item.employeeId === employeeId && item.evaluatorId === evaluatorId);
        return existing?.status === "SUBMITTED";
      });
  }).length;

  const initialDimensionChecks = buildInitialDimensionChecks(
    [...employeeUsers, ...leaderUsers].map((employee) => {
      const assignment = assignments.get(employee.id);
      const currentEval = allSupervisorEvals.find((item) =>
        item.employeeId === employee.id
        && Boolean(assignment?.currentEvaluatorIds.includes(item.evaluatorId)),
      ) || null;

      return {
        id: employee.id,
        name: employee.name,
        department: employee.department,
        performanceStars: currentEval?.performanceStars ?? null,
        abilityStars: currentEval?.abilityStars ?? null,
        valuesStars: currentEval?.valuesStars ?? null,
        performanceComment: currentEval?.performanceComment || "",
        abilityComment: currentEval?.abilityComment || "",
        valuesComment: currentEval?.valuesComment || "",
        candidComment: currentEval?.candidComment || "",
        progressComment: currentEval?.progressComment || "",
        altruismComment: currentEval?.altruismComment || "",
        rootComment: currentEval?.rootComment || "",
      };
    }),
  );
  const distributionComplianceChecks = buildDistributionComplianceChecks(mergedDistribution);

  return {
    cycle: {
      id: cycle.id,
      name: cycle.name,
      status: cycle.status,
      calibrationStart: cycle.calibrationStart.toISOString(),
      calibrationEnd: cycle.calibrationEnd.toISOString(),
    },
    canAccess: true,
    config: {
      ...config,
      accessUsers: configUsers.accessUsers,
      finalizers: configUsers.finalizers,
      leaderEvaluators: canViewLeaderEvaluationDetails ? configUsers.leaderEvaluators : [],
      leaderSubjects: configUsers.leaderSubjects,
    },
    overview: {
      principles: [
        "绩效公平",
        "绩效分布合理",
        "绩效导向坚定",
      ],
      chainGuidance: [
        "上级初评需综合考量业绩产出结果、综合能力、价值观",
        "当前链路较短，上级初评后直接进入承霖、邱翔的公司级终评校准",
      ],
      distributionHints: [
        "五星≤10%",
        "四星≤20%",
        "三星50%+",
        "二星≤15%",
        "一星≤5%",
      ],
      companyCalibrators: configUsers.finalizers,
      initialDimensionChecks,
      distributionComplianceChecks,
      riskSummary: [
        ...distributionComplianceChecks.filter((item) => !item.compliant && item.deltaCount > 0).map((item) => item.summary),
        `普通员工待双人一致 ${employeeRows.filter((item) => item.officialStars == null).length} 人`,
        `主管层待双人提交完成 ${leaderRows.filter((item) => item.officialStars == null).length} 人`,
      ],
      progress: {
        employeeOpinionDone: employeeRows.reduce((sum, item) => sum + item.handledCount, 0),
        employeeOpinionTotal: employeeRows.length * Math.max(employeeOpinionActorIds.length, 1),
        employeeConfirmedCount: employeeRows.filter((item) => item.officialStars != null).length,
        employeeTotalCount: employeeRows.length,
        leaderSubmittedCounts: buildLeaderEvaluatorProgress(
          config.leaderEvaluatorUserIds,
          usersById,
          leaderReviews,
          canViewLeaderEvaluationDetails,
        ),
        leaderConfirmedCount: leaderRows.filter((item) => item.officialStars != null).length,
        leaderTotalCount: leaderRows.length,
      },
    },
    employeeReview: {
      overview: {
        companyCount: companyPeople.length,
        initialEvalSubmissionRate: assignmentEmployeeIds.length > 0 ? Math.round((submittedEmployeeCount / assignmentEmployeeIds.length) * 100) : 0,
        officialCompletionRate: companyPeople.length > 0
          ? Math.round((companyPeople.filter((item) => item.officialStars != null).length / companyPeople.length) * 100)
          : 0,
        pendingOfficialCount: employeeRows.filter((item) => item.officialStars == null).length,
      },
      companyDistribution: mergedDistribution,
      employeeDistribution,
      departmentDistributions,
      employees: employeeRows.sort((left, right) => {
        const leftRank = (left.officialStars == null ? 0 : 1) + (left.anomalyTags.length > 0 ? 0 : 2);
        const rightRank = (right.officialStars == null ? 0 : 1) + (right.anomalyTags.length > 0 ? 0 : 2);
        if (leftRank !== rightRank) return leftRank - rightRank;
        return left.department.localeCompare(right.department) || left.name.localeCompare(right.name);
      }),
    },
    leaderReview: {
      overview: {
        leaderCount: leaderRows.length,
        confirmedCount: leaderRows.filter((item) => item.officialStars != null).length,
        evaluatorProgress: buildLeaderEvaluatorProgress(
          config.leaderEvaluatorUserIds,
          usersById,
          leaderReviews,
          canViewLeaderEvaluationDetails,
        ),
      },
      leaders: leaderRows,
      leaderDistribution,
      companyDistributions: {
        all: mergedDistribution,
        leaderOnly: leaderDistribution,
        employeeOnly: employeeOnlyDistribution,
      },
    },
  };
}
