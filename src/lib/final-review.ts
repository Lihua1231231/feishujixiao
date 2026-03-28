import { prisma } from "@/lib/db";
import { resolveDefaultEmployeeSubjectIds } from "@/lib/final-review-defaults";
import { getActiveCycle, type SessionUser } from "@/lib/session";
import { buildSupervisorAssignmentMap } from "@/lib/supervisor-assignments";

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
  if (performanceStars == null || abilityStars == null || valuesStars == null) return null;
  return performanceStars * 0.5 + abilityStars * 0.3 + valuesStars * 0.2;
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

  return {
    cycleId,
    accessUserIds: parseJsonArray(record?.accessUserIds),
    finalizerUserIds: parseJsonArray(record?.finalizerUserIds),
    leaderEvaluatorUserIds: parseJsonArray(record?.leaderEvaluatorUserIds),
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

function truncateSummary(value: string, maxLength = 160): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function buildSupervisorCommentSummary(evaluations: Array<{
  evaluator: { name: string };
  performanceComment: string;
  abilityComment: string;
  candidComment: string;
  progressComment: string;
  altruismComment: string;
  rootComment: string;
}>): string | null {
  const summaries = evaluations.flatMap((evaluation) => {
    const comment = [
      ["业绩", normalizeSummaryText(evaluation.performanceComment)],
      ["能力", normalizeSummaryText(evaluation.abilityComment)],
      ["坦诚真实", normalizeSummaryText(evaluation.candidComment)],
      ["极致进取", normalizeSummaryText(evaluation.progressComment)],
      ["成就利他", normalizeSummaryText(evaluation.altruismComment)],
      ["ROOT", normalizeSummaryText(evaluation.rootComment)],
    ]
      .flatMap(([label, value]) => (value ? [`${label}：${value}`] : []))
      .filter((value): value is string => Boolean(value))
      .join("；");

    if (!comment) return [];
    return [`${evaluation.evaluator.name}：${comment}`];
  });

  if (!summaries.length) return null;
  return truncateSummary(summaries.slice(0, 2).join(" / "));
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
  const config = getFinalReviewConfigValue(cycle.id, configRecord, reviewUsers);
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

  const [allSupervisorEvals, calibrations, selfEvals, peerReviews, opinions, leaderReviews, confirmations] = await Promise.all([
    prisma.supervisorEval.findMany({
      where: { cycleId: cycle.id },
      select: {
        employeeId: true,
        evaluatorId: true,
        weightedScore: true,
        status: true,
        performanceComment: true,
        abilityComment: true,
        candidComment: true,
        progressComment: true,
        altruismComment: true,
        rootComment: true,
        evaluator: { select: { id: true, name: true } },
      },
    }),
    prisma.calibrationResult.findMany({
      where: { cycleId: cycle.id },
      select: { userId: true, finalStars: true },
    }),
    prisma.selfEvaluation.findMany({
      where: { cycleId: cycle.id },
      select: { userId: true, status: true, importedAt: true },
    }),
    prisma.peerReview.findMany({
      where: { cycleId: cycle.id, status: "SUBMITTED" },
      select: {
        revieweeId: true,
        outputScore: true,
        collaborationScore: true,
        valuesScore: true,
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

  const calibrationMap = new Map(calibrations.map((item) => [item.userId, item.finalStars]));
  const selfEvalMap = new Map(selfEvals.map((item) => [item.userId, item]));
  const latestConfirmationMap = getLatestConfirmationMap(confirmations);

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
  const peerReviewGroups = new Map<string, typeof peerReviews>();
  for (const review of peerReviews) {
    const current = peerReviewGroups.get(review.revieweeId) || [];
    current.push(review);
    peerReviewGroups.set(review.revieweeId, current);
  }
  for (const [employeeId, reviews] of peerReviewGroups.entries()) {
    const total = reviews.reduce((sum, review) => sum + (review.outputScore || 0) + (review.collaborationScore || 0) + (review.valuesScore || 0), 0);
    peerReviewAverageByEmployee.set(employeeId, roundToOneDecimal(total / (reviews.length * 3)) || 0);
  }

  const leaderSubjectIds = new Set(config.leaderSubjectUserIds);
  const employeeSubjectIds = new Set(config.employeeSubjectUserIds);
  const employeeUsers = reviewUsers.filter((item) =>
    employeeSubjectIds.has(item.id) && !leaderSubjectIds.has(item.id),
  );
  const leaderUsers = reviewUsers.filter((item) => leaderSubjectIds.has(item.id));
  const companyPeople = [...employeeUsers, ...leaderUsers].map((item) => {
    const latestEmployeeConfirmation = latestConfirmationMap.get(`EMPLOYEE:${item.id}`);
    const latestLeaderConfirmation = latestConfirmationMap.get(`LEADER:${item.id}`);
    const officialStars = latestLeaderConfirmation?.officialStars
      ?? latestEmployeeConfirmation?.officialStars
      ?? calibrationMap.get(item.id)
      ?? null;
    return {
      user: item,
      officialStars,
    };
  });
  const canFinalize = user.role === "ADMIN" || config.finalizerUserIds.includes(user.id);
  const canViewOpinionDetails = canFinalize;
  const canViewLeaderEvaluationDetails =
    canFinalize || config.leaderEvaluatorUserIds.includes(user.id);

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
    const employeeOpinions = opinionsByEmployee.get(employee.id) || [];
    const latestConfirmation = latestConfirmationMap.get(`EMPLOYEE:${employee.id}`);
    const handledCount = employeeOpinions.filter((item) => item.decision !== "PENDING").length;
    const officialStars = latestConfirmation?.officialStars ?? calibrationMap.get(employee.id) ?? null;
    const currentStars = officialStars ?? referenceStars;
    const overrideOpinionCount = employeeOpinions.filter((item) => item.decision === "OVERRIDE").length;
    const pendingOpinionCount = Math.max(0, config.accessUserIds.length - handledCount);
    const scoreSpread = getWeightedScoreSpread(currentEvals.map((item) => item.weightedScore != null ? Number(item.weightedScore) : null));
    const supervisorCommentSummary = buildSupervisorCommentSummary(currentEvals);
    const opinionCards = config.accessUserIds.map((reviewerId) => {
      const reviewer = usersById.get(reviewerId);
      const opinion = employeeOpinions.find((item) => item.reviewerId === reviewerId);
      const meta = pickOpinionStatusMeta(opinion?.decision || "PENDING", opinion?.suggestedStars ?? referenceStars);
      return {
        reviewerId,
        reviewerName: canViewOpinionDetails ? reviewer?.name || "未配置" : "终评相关人",
        decision: opinion?.decision || "PENDING",
        decisionLabel: meta.label,
        suggestedStars: canViewOpinionDetails ? opinion?.suggestedStars ?? meta.suggestedStars : null,
        reason: canViewOpinionDetails ? opinion?.reason || "" : "",
        isMine: reviewerId === user.id,
        updatedAt: opinion?.updatedAt?.toISOString() || null,
      };
    });

    const anomalyTags: string[] = [];
    if (overrideOpinionCount > 0) anomalyTags.push("存在改星意见");
    if (scoreSpread != null && scoreSpread >= 1) anomalyTags.push("初评分差较大");
    if (officialStars != null && referenceStars != null && officialStars !== referenceStars) {
      anomalyTags.push("已拍板改星");
    }

    return {
      id: employee.id,
      name: employee.name,
      department: employee.department,
      jobTitle: employee.jobTitle,
      weightedScore,
      referenceStars,
      referenceSourceLabel: "参考星级由初评加权分换算",
      officialStars,
      officialReason: latestConfirmation?.reason || "",
      officialConfirmedAt: latestConfirmation?.createdAt.toISOString() || null,
      officialConfirmerName: latestConfirmation ? usersById.get(latestConfirmation.confirmerId)?.name || latestConfirmation.confirmerId : null,
      finalizable: canFinalize,
      canViewOpinionDetails,
      currentEvaluatorNames: assignment?.currentEvaluatorNames || [],
      currentEvaluatorStatuses: currentEvals.map((item) => ({
        evaluatorId: item.evaluatorId,
        evaluatorName: item.evaluator.name,
        status: item.status,
        weightedScore: item.weightedScore != null ? Number(item.weightedScore) : null,
      })),
      selfEvalStatus: selfEvalMap.get(employee.id)?.status || null,
      peerAverage: peerReviewAverageByEmployee.get(employee.id) ?? null,
      supervisorCommentSummary: supervisorCommentSummary,
      handledCount,
      totalReviewerCount: config.accessUserIds.length,
      summaryStats: {
        handledCount,
        totalReviewerCount: config.accessUserIds.length,
        pendingCount: pendingOpinionCount,
        overrideCount: overrideOpinionCount,
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
        editable: user.role === "ADMIN" || evaluatorId === user.id,
        submittedAt: existing?.submittedAt?.toISOString() || null,
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
    const latestConfirmation = latestConfirmationMap.get(`LEADER:${leader.id}`);

    return {
      id: leader.id,
      name: leader.name,
      department: leader.department,
      jobTitle: leader.jobTitle,
      officialStars: latestConfirmation?.officialStars ?? calibrationMap.get(leader.id) ?? null,
      officialReason: latestConfirmation?.reason || "",
      officialConfirmedAt: latestConfirmation?.createdAt.toISOString() || null,
      officialConfirmerName: latestConfirmation ? usersById.get(latestConfirmation.confirmerId)?.name || latestConfirmation.confirmerId : null,
      finalizable: canFinalize,
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
      bothSubmitted: isLeaderFinalReviewReady(config, evaluations),
    };
  });

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
        "当前链路较短，终评阶段更需要统一口径和分布校准",
      ],
      distributionHints: [
        "五星≤10%",
        "四星≤20%",
        "三星50%+",
        "二星≤15%",
        "一星≤5%",
      ],
      riskSummary: [
        ...mergedDistribution.filter((item) => item.exceeded && item.delta > 0).map((item) => `${item.stars}星${item.stars === 3 ? "不足" : "超出"}${item.delta}人`),
        `普通员工待最终确认 ${employeeRows.filter((item) => item.officialStars == null).length} 人`,
        `主管层待最终确认 ${leaderRows.filter((item) => item.officialStars == null).length} 人`,
      ],
      progress: {
        employeeOpinionDone: employeeRows.reduce((sum, item) => sum + item.handledCount, 0),
        employeeOpinionTotal: employeeRows.length * Math.max(config.accessUserIds.length, 1),
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
