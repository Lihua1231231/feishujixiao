import { prisma } from "@/lib/db";
import {
  buildSupervisorAssignmentMap,
  EVAL_LIST_NAMES,
  GROUP_B_NAMES,
  isGroupBUser,
} from "@/lib/supervisor-assignments";

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
  peerReviewAssignedSubmitted: number;
  peerReviewAssignedTotal: number;
  peerReviewAssignedComplete: boolean;
  supEval: VerifySupervisorEval[];
  supervisorExpectedEvaluatorNames: string[];
  supervisorSubmittedEvaluatorNames: string[];
  supervisorPendingEvaluatorNames: string[];
  legacyEvaluators: string[];
  supervisorComplete: boolean;
  followUpFlags: string[];
  followUpSummary: string;
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

  const [allUsers, selfEvals, nominations, peerReviews, supervisorEvals] = await Promise.all([
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
      select: { reviewerId: true, revieweeId: true, status: true },
    }),
    prisma.supervisorEval.findMany({
      where: { cycleId: cycle.id },
      include: { evaluator: { select: { name: true } } },
    }),
  ]);

  const userByName = new Map(allUsers.map((user) => [user.name, user]));
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

  const peerReviewReceivedByReviewee = new Map<string, { total: number; submitted: number }>();
  const peerReviewAssignedByReviewer = new Map<string, { total: number; submitted: number }>();
  for (const review of peerReviews) {
    const received = peerReviewReceivedByReviewee.get(review.revieweeId) || { total: 0, submitted: 0 };
    received.total += 1;
    if (review.status === "SUBMITTED") {
      received.submitted += 1;
    }
    peerReviewReceivedByReviewee.set(review.revieweeId, received);

    const assigned = peerReviewAssignedByReviewer.get(review.reviewerId) || { total: 0, submitted: 0 };
    assigned.total += 1;
    if (review.status === "SUBMITTED") {
      assigned.submitted += 1;
    }
    peerReviewAssignedByReviewer.set(review.reviewerId, assigned);
  }

  const supervisorEvalByEmployee = new Map<string, VerifySupervisorEval[]>();
  for (const supervisorEval of supervisorEvals) {
    const current = supervisorEvalByEmployee.get(supervisorEval.employeeId) || [];
    current.push({
      evaluator: supervisorEval.evaluator.name,
      status: supervisorEval.status,
    });
    supervisorEvalByEmployee.set(supervisorEval.employeeId, current);
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
        peerReviewAssignedSubmitted: 0,
        peerReviewAssignedTotal: 0,
        peerReviewAssignedComplete: false,
        supEval: [],
        supervisorExpectedEvaluatorNames: [],
        supervisorSubmittedEvaluatorNames: [],
        supervisorPendingEvaluatorNames: [],
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
    const peerReviewReceived = peerReviewReceivedByReviewee.get(user.id) || { total: 0, submitted: 0 };
    const peerReviewAssigned = peerReviewAssignedByReviewer.get(user.id) || { total: 0, submitted: 0 };
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
    const peerReviewAssignedComplete =
      peerReviewAssigned.total === 0 || peerReviewAssigned.submitted >= peerReviewAssigned.total;
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
      peerReviewAssignedSubmitted: peerReviewAssigned.submitted,
      peerReviewAssignedTotal: peerReviewAssigned.total,
      peerReviewAssignedComplete,
      supEval: existingSupervisorEvals,
      supervisorExpectedEvaluatorNames,
      supervisorSubmittedEvaluatorNames,
      supervisorPendingEvaluatorNames,
      legacyEvaluators: assignment?.legacyEvaluatorNames || [],
      supervisorComplete,
      followUpFlags,
      followUpSummary: followUpFlags.length > 0 ? followUpFlags.join("；") : "已完成",
    };
  });

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
  };
}
