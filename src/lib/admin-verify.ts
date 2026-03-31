import { prisma } from "@/lib/db";
import { getAppliedNormalizationMap } from "@/lib/applied-normalization";
import { DEFAULT_REFERENCE_STAR_RANGES, mapScoreToReferenceStars } from "@/lib/final-review";
import { computePeerReviewAverageFromReviews } from "@/lib/peer-review-summary";
import {
  buildSupervisorAssignmentMap,
  EVAL_LIST_NAMES,
  GROUP_B_NAMES,
  isGroupBUser,
} from "@/lib/supervisor-assignments";
import { roundToOneDecimal } from "@/lib/weighted-score";

export const PEER_NOMINATION_MIN_COUNT = 5;

type VerifySelfEval = {
  status: string;
  hasUrl: boolean;
  hasContent: boolean;
  sourceUrl: string | null;
} | null;

type VerifyNominations = {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
};

type VerifySupervisorEval = {
  evaluator: string;
  status: string;
};

export type VerifyRosterRow = {
  name: string;
  inSystem: boolean;
  isGroupB: boolean;
  department: string | null;
  role?: string;
  supervisor: string | null;
  selfEval: VerifySelfEval;
  nominations: VerifyNominations | null;
  peerNominationCount: number;
  peerNominationComplete: boolean;
  peerReviewReceivedSubmitted: number;
  peerReviewReceivedTotal: number;
  peerReviewReceivedComplete: boolean;
  peerReviewReceivedPendingReviewerNames: string[];
  peerReviewAssignedSubmitted: number;
  peerReviewAssignedTotal: number;
  peerReviewAssignedComplete: boolean;
  peerReviewAssignedPendingRevieweeNames: string[];
  supEval: VerifySupervisorEval[];
  supervisorExpectedEvaluatorNames: string[];
  supervisorSubmittedEvaluatorNames: string[];
  supervisorPendingEvaluatorNames: string[];
  rawPeerReviewScore: number | null;
  normalizedPeerReviewScore: number | null;
  rawSupervisorScore: number | null;
  normalizedSupervisorScore: number | null;
  rawSupervisorStars: number | null;
  normalizedSupervisorStars: number | null;
  legacyEvaluators: string[];
  supervisorComplete: boolean;
  followUpFlags: string[];
  followUpSummary: string;
};

export type VerifyFollowUpRow = {
  name: string;
  department: string | null;
  pendingPeerReviewCount: number;
  pendingPeerReviewRevieweeNames: string[];
  pendingSupervisorEvalCount: number;
  pendingSupervisorEvalEmployeeNames: string[];
};

export type VerifySummary = {
  total: number;
  inSystem: number;
  missing: number;
  groupA: number;
  groupB: number;
  selfEvalDone: number;
  selfEvalMissing: number;
  peerNominationIncomplete: number;
  peerReviewReceivedIncomplete: number;
  peerReviewAssignedIncomplete: number;
  supervisorIncomplete: number;
};

export type VerifyData = {
  cycleId: string;
  cycleName: string;
  cycleStatus: string;
  summary: VerifySummary;
  roster: VerifyRosterRow[];
  followUpSheetRows: VerifyFollowUpRow[];
};

function buildFollowUpFlags(row: {
  peerNominationComplete: boolean;
  peerReviewReceivedComplete: boolean;
  peerReviewAssignedComplete: boolean;
  supervisorComplete: boolean;
}) {
  const flags: string[] = [];

  if (!row.peerNominationComplete) {
    flags.push("360提名不足");
  }
  if (!row.peerReviewReceivedComplete) {
    flags.push("360被评未完成");
  }
  if (!row.peerReviewAssignedComplete) {
    flags.push("360待评他人未完成");
  }
  if (!row.supervisorComplete) {
    flags.push("绩效初评未完成");
  }

  return flags;
}

export async function buildAdminVerifyData(): Promise<VerifyData | null> {
  const cycle = await prisma.reviewCycle.findFirst({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
  });

  if (!cycle) {
    return null;
  }

  const [allUsers, selfEvals, nominations, peerReviews, supervisorEvals, normalizedPeerReviewMap, normalizedSupervisorMap] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        department: true,
        role: true,
        supervisorId: true,
        supervisor: { select: { id: true, name: true } },
      },
    }),
    prisma.selfEvaluation.findMany({
      where: { cycleId: cycle.id },
      select: { userId: true, status: true, sourceUrl: true, importedContent: true },
    }),
    prisma.reviewerNomination.findMany({
      where: { cycleId: cycle.id },
      select: { nominatorId: true, supervisorStatus: true },
    }),
    prisma.peerReview.findMany({
      where: { cycleId: cycle.id },
      select: {
        reviewerId: true,
        revieweeId: true,
        status: true,
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
    }),
    prisma.supervisorEval.findMany({
      where: { cycleId: cycle.id },
      include: { evaluator: { select: { name: true } } },
    }),
    getAppliedNormalizationMap(cycle.id, "PEER_REVIEW"),
    getAppliedNormalizationMap(cycle.id, "SUPERVISOR_EVAL"),
  ]);

  const userByName = new Map(allUsers.map((user) => [user.name, user]));
  const userById = new Map(allUsers.map((user) => [user.id, user]));
  const selfEvalByUserId = new Map(selfEvals.map((selfEval) => [selfEval.userId, selfEval]));

  const nominationsByNominator = new Map<string, VerifyNominations>();
  for (const nomination of nominations) {
    const current = nominationsByNominator.get(nomination.nominatorId) || {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
    };

    current.total += 1;
    if (nomination.supervisorStatus === "APPROVED") {
      current.approved += 1;
    } else if (nomination.supervisorStatus === "PENDING") {
      current.pending += 1;
    } else if (nomination.supervisorStatus === "REJECTED") {
      current.rejected += 1;
    }

    nominationsByNominator.set(nomination.nominatorId, current);
  }

  const peerReviewReceivedByReviewee = new Map<string, { total: number; submitted: number; pendingReviewerNames: string[] }>();
  const peerReviewAssignedByReviewer = new Map<string, { total: number; submitted: number; pendingRevieweeNames: string[] }>();
  const peerReviewScoresByReviewee = new Map<string, typeof peerReviews>();
  for (const review of peerReviews) {
    const reviewerName = userById.get(review.reviewerId)?.name || review.reviewerId;
    const received = peerReviewReceivedByReviewee.get(review.revieweeId) || { total: 0, submitted: 0, pendingReviewerNames: [] };
    received.total += 1;
    if (review.status === "SUBMITTED") {
      received.submitted += 1;
      const currentScores = peerReviewScoresByReviewee.get(review.revieweeId) || [];
      currentScores.push(review);
      peerReviewScoresByReviewee.set(review.revieweeId, currentScores);
    } else {
      received.pendingReviewerNames.push(reviewerName);
    }
    peerReviewReceivedByReviewee.set(review.revieweeId, received);
    const revieweeName = userById.get(review.revieweeId)?.name || review.revieweeId;
    const assigned = peerReviewAssignedByReviewer.get(review.reviewerId) || { total: 0, submitted: 0, pendingRevieweeNames: [] };
    assigned.total += 1;
    if (review.status === "SUBMITTED") {
      assigned.submitted += 1;
    } else {
      assigned.pendingRevieweeNames.push(revieweeName);
    }
    peerReviewAssignedByReviewer.set(review.reviewerId, assigned);
  }

  const supervisorEvalByEmployee = new Map<string, VerifySupervisorEval[]>();
  const supervisorSubmittedKeys = new Set<string>();
  for (const supervisorEval of supervisorEvals) {
    const current = supervisorEvalByEmployee.get(supervisorEval.employeeId) || [];
    current.push({
      evaluator: supervisorEval.evaluator.name,
      status: supervisorEval.status,
    });
    supervisorEvalByEmployee.set(supervisorEval.employeeId, current);
    if (supervisorEval.status === "SUBMITTED") {
      supervisorSubmittedKeys.add(`${supervisorEval.employeeId}:${supervisorEval.evaluatorId}`);
    }
  }

  const assignments = buildSupervisorAssignmentMap(
    allUsers.map((user) => ({
      id: user.id,
      name: user.name,
      supervisorId: user.supervisorId,
      supervisor: user.supervisor,
    })),
    supervisorEvals.map((supervisorEval) => ({
      employeeId: supervisorEval.employeeId,
      evaluatorId: supervisorEval.evaluatorId,
      evaluatorName: supervisorEval.evaluator.name,
    }))
  );

  const rawPeerReviewScoreByUserId = new Map<string, number | null>();
  for (const [revieweeId, reviews] of peerReviewScoresByReviewee.entries()) {
    rawPeerReviewScoreByUserId.set(revieweeId, computePeerReviewAverageFromReviews(reviews));
  }

  const rawSupervisorScoreByUserId = new Map<string, number | null>();
  const rawSupervisorStarsByUserId = new Map<string, number | null>();
  for (const assignment of assignments.values()) {
    const submittedCurrentEvals = supervisorEvals.filter((item) =>
      item.employeeId === assignment.employeeId
      && item.status === "SUBMITTED"
      && assignment.currentEvaluatorIds.includes(item.evaluatorId),
    );
    const scores = submittedCurrentEvals
      .map((item) => (item.weightedScore != null ? Number(item.weightedScore) : null))
      .filter((value): value is number => value != null && !Number.isNaN(value));
    const rawSupervisorScore = scores.length > 0
      ? roundToOneDecimal(scores.reduce((sum, value) => sum + value, 0) / scores.length)
      : null;
    rawSupervisorScoreByUserId.set(assignment.employeeId, rawSupervisorScore);
    rawSupervisorStarsByUserId.set(
      assignment.employeeId,
      mapScoreToReferenceStars(rawSupervisorScore, DEFAULT_REFERENCE_STAR_RANGES),
    );
  }

  const roster: VerifyRosterRow[] = EVAL_LIST_NAMES.map((name) => {
    const user = userByName.get(name);
    const isGroupB = isGroupBUser(name);

    if (!user) {
      return {
        name,
        inSystem: false,
        isGroupB,
        department: null,
        supervisor: null,
        selfEval: null,
        nominations: null,
        peerNominationCount: 0,
        peerNominationComplete: false,
        peerReviewReceivedSubmitted: 0,
        peerReviewReceivedTotal: 0,
        peerReviewReceivedComplete: false,
        peerReviewReceivedPendingReviewerNames: [],
        peerReviewAssignedSubmitted: 0,
        peerReviewAssignedTotal: 0,
        peerReviewAssignedComplete: false,
        peerReviewAssignedPendingRevieweeNames: [],
        supEval: [],
        supervisorExpectedEvaluatorNames: [],
        supervisorSubmittedEvaluatorNames: [],
        supervisorPendingEvaluatorNames: [],
        rawPeerReviewScore: null,
        normalizedPeerReviewScore: null,
        rawSupervisorScore: null,
        normalizedSupervisorScore: null,
        rawSupervisorStars: null,
        normalizedSupervisorStars: null,
        legacyEvaluators: [],
        supervisorComplete: false,
        followUpFlags: [],
        followUpSummary: "系统缺失",
      };
    }

    const selfEval = selfEvalByUserId.get(user.id);
    const nominationSummary = nominationsByNominator.get(user.id) || {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
    };
    const peerReviewReceived = peerReviewReceivedByReviewee.get(user.id) || { total: 0, submitted: 0, pendingReviewerNames: [] };
    const peerReviewAssigned = peerReviewAssignedByReviewer.get(user.id) || { total: 0, submitted: 0, pendingRevieweeNames: [] };
    const assignment = assignments.get(user.id);
    const existingSupervisorEvals = supervisorEvalByEmployee.get(user.id) || [];

    const supervisorExpectedEvaluatorNames = assignment?.currentEvaluatorNames || [];
    const supervisorSubmittedEvaluatorNames = supervisorExpectedEvaluatorNames.filter((evaluatorName) =>
      existingSupervisorEvals.some((item) => item.evaluator === evaluatorName && item.status === "SUBMITTED")
    );
    const supervisorPendingEvaluatorNames = supervisorExpectedEvaluatorNames.filter(
      (evaluatorName) => !supervisorSubmittedEvaluatorNames.includes(evaluatorName)
    );

    const peerNominationComplete = nominationSummary.total >= PEER_NOMINATION_MIN_COUNT;
    const peerReviewReceivedComplete =
      peerReviewReceived.total > 0 && peerReviewReceived.submitted >= peerReviewReceived.total;
    const peerReviewReceivedPendingReviewerNames = peerReviewReceived.pendingReviewerNames;
    const peerReviewAssignedComplete =
      peerReviewAssigned.total === 0 || peerReviewAssigned.submitted >= peerReviewAssigned.total;
    const peerReviewAssignedPendingRevieweeNames = peerReviewAssigned.pendingRevieweeNames;
    const supervisorComplete =
      supervisorExpectedEvaluatorNames.length > 0 && supervisorPendingEvaluatorNames.length === 0;

    const followUpFlags = buildFollowUpFlags({
      peerNominationComplete,
      peerReviewReceivedComplete,
      peerReviewAssignedComplete,
      supervisorComplete,
    });

    return {
      name,
      inSystem: true,
      isGroupB,
      department: user.department,
      role: user.role,
      supervisor: user.supervisor?.name || null,
      selfEval: selfEval
        ? {
            status: selfEval.status,
            hasUrl: Boolean(selfEval.sourceUrl),
            hasContent: Boolean(selfEval.importedContent && selfEval.importedContent.length > 0),
            sourceUrl: selfEval.sourceUrl,
          }
        : null,
      nominations: nominationSummary,
      peerNominationCount: nominationSummary.total,
      peerNominationComplete,
      peerReviewReceivedSubmitted: peerReviewReceived.submitted,
      peerReviewReceivedTotal: peerReviewReceived.total,
      peerReviewReceivedComplete,
      peerReviewReceivedPendingReviewerNames,
      peerReviewAssignedSubmitted: peerReviewAssigned.submitted,
      peerReviewAssignedTotal: peerReviewAssigned.total,
      peerReviewAssignedComplete,
      peerReviewAssignedPendingRevieweeNames,
      supEval: existingSupervisorEvals,
      supervisorExpectedEvaluatorNames,
      supervisorSubmittedEvaluatorNames,
      supervisorPendingEvaluatorNames,
      rawPeerReviewScore: rawPeerReviewScoreByUserId.get(user.id) ?? null,
      normalizedPeerReviewScore: normalizedPeerReviewMap.get(user.id)?.normalizedScore ?? null,
      rawSupervisorScore: rawSupervisorScoreByUserId.get(user.id) ?? null,
      normalizedSupervisorScore: normalizedSupervisorMap.get(user.id)?.normalizedScore ?? null,
      rawSupervisorStars: rawSupervisorStarsByUserId.get(user.id) ?? null,
      normalizedSupervisorStars: normalizedSupervisorMap.get(user.id)?.normalizedStars ?? null,
      legacyEvaluators: assignment?.legacyEvaluatorNames || [],
      supervisorComplete,
      followUpFlags,
      followUpSummary: followUpFlags.length > 0 ? followUpFlags.join("；") : "已完成",
    };
  });

  const supervisorPendingByEvaluatorId = new Map<string, string[]>();
  for (const assignment of assignments.values()) {
    assignment.currentEvaluatorIds.forEach((evaluatorId, index) => {
      if (supervisorSubmittedKeys.has(`${assignment.employeeId}:${evaluatorId}`)) {
        return;
      }
      const pendingEmployees = supervisorPendingByEvaluatorId.get(evaluatorId) || [];
      pendingEmployees.push(assignment.employeeName || assignment.currentEvaluatorNames[index] || assignment.employeeId);
      supervisorPendingByEvaluatorId.set(evaluatorId, pendingEmployees);
    });
  }

  const followUpSheetRows: VerifyFollowUpRow[] = allUsers
    .map((user) => {
      const pendingPeerReviewRevieweeNames = [...(peerReviewAssignedByReviewer.get(user.id)?.pendingRevieweeNames || [])]
        .sort((a, b) => a.localeCompare(b));
      const pendingSupervisorEvalEmployeeNames = [...(supervisorPendingByEvaluatorId.get(user.id) || [])]
        .sort((a, b) => a.localeCompare(b));

      return {
        name: user.name,
        department: user.department,
        pendingPeerReviewCount: pendingPeerReviewRevieweeNames.length,
        pendingPeerReviewRevieweeNames,
        pendingSupervisorEvalCount: pendingSupervisorEvalEmployeeNames.length,
        pendingSupervisorEvalEmployeeNames,
      };
    })
    .sort((a, b) => (a.department || "").localeCompare(b.department || "") || a.name.localeCompare(b.name));

  const summary: VerifySummary = {
    total: EVAL_LIST_NAMES.length,
    inSystem: roster.filter((row) => row.inSystem).length,
    missing: roster.filter((row) => !row.inSystem).length,
    groupA: roster.filter((row) => !row.isGroupB).length,
    groupB: GROUP_B_NAMES.length,
    selfEvalDone: roster.filter((row) => row.inSystem && !row.isGroupB && Boolean(row.selfEval?.hasUrl)).length,
    selfEvalMissing: roster.filter((row) => row.inSystem && !row.isGroupB && !row.selfEval?.hasUrl).length,
    peerNominationIncomplete: roster.filter((row) => row.inSystem && !row.peerNominationComplete).length,
    peerReviewReceivedIncomplete: roster.filter((row) => row.inSystem && !row.peerReviewReceivedComplete).length,
    peerReviewAssignedIncomplete: roster.filter((row) => row.inSystem && !row.peerReviewAssignedComplete).length,
    supervisorIncomplete: roster.filter((row) => row.inSystem && !row.supervisorComplete).length,
  };

  return {
    cycleId: cycle.id,
    cycleName: cycle.name,
    cycleStatus: cycle.status,
    summary,
    roster,
    followUpSheetRows,
  };
}
