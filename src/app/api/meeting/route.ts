import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, getActiveCycle } from "@/lib/session";
import {
  getFinalReviewConfigValue,
  mapScoreToReferenceStars,
} from "@/lib/final-review";
import { resolveEmployeeConsensus } from "@/lib/final-review-logic";
import {
  buildPeerReviewCategorySummary,
  getPeerReviewPerformanceAverage,
  getPeerReviewAbilityAverage,
  getPeerReviewValuesAverage,
} from "@/lib/peer-review-summary";
import { getAppliedNormalizationMap } from "@/lib/applied-normalization";
import { buildSupervisorAssignmentMap } from "@/lib/supervisor-assignments";
import { computeWeightedScoreFromDimensions } from "@/lib/weighted-score";
import { buildMeetingInterviewerMap, getAssignedEmployeeIds, type DbInterviewerOverrides } from "@/lib/meeting-assignments";

function roundToOneDecimal(value: number | null): number | null {
  if (value == null) return null;
  return Math.round(value * 10) / 10;
}

function parseDbOverrides(raw: string | undefined | null): DbInterviewerOverrides {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

// Get interview data
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const cycle = await getActiveCycle();
    if (!cycle) return NextResponse.json({ role: "EMPLOYEE", cycleStatus: null, items: [] });

    const isSupervisor = ["SUPERVISOR", "HRBP", "ADMIN"].includes(user.role);

    // Admin perspective toggle: ?view=employee&employeeId=xxx
    const url = new URL(req.url);
    const viewParam = url.searchParams.get("view");
    if (viewParam === "employee" && user.role === "ADMIN") {
      const employeeId = url.searchParams.get("employeeId");
      if (!employeeId) {
        return NextResponse.json({ error: "employeeId required" }, { status: 400 });
      }
      const targetUser = await prisma.user.findUnique({
        where: { id: employeeId },
        select: { id: true, name: true, role: true },
      });
      if (!targetUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      const empData = await buildEmployeeData(targetUser, cycle);
      return NextResponse.json({ ...empData, adminPreview: true, employeeName: targetUser.name });
    }

    if (isSupervisor) {
      return NextResponse.json(await buildSupervisorData(user, cycle));
    }

    // Employee view: only when cycle is in MEETING phase
    return NextResponse.json(await buildEmployeeData(user, cycle));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

async function buildSupervisorData(
  user: { id: string; role: string; name: string },
  cycle: { id: string; name: string; status: string },
) {
  // Get all users for assignment resolution and config
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, department: true, role: true, jobTitle: true, supervisorId: true, supervisor: { select: { id: true, name: true } } },
  });

  // Build interviewer map and find assigned employees
  const meetingConfig = await prisma.finalReviewConfig.findUnique({
    where: { cycleId: cycle.id },
    select: { meetingInterviewerOverrides: true },
  });
  const dbOverrides = parseDbOverrides(meetingConfig?.meetingInterviewerOverrides);
  const interviewerMap = buildMeetingInterviewerMap(allUsers, dbOverrides);
  const assignedEmployeeIds = getAssignedEmployeeIds(interviewerMap, user.id);

  if (assignedEmployeeIds.length === 0) {
    return { role: "SUPERVISOR", userRole: user.role, cycleStatus: cycle.status, cycleName: cycle.name, items: [] };
  }

  const subordinates = allUsers
    .filter((u) => assignedEmployeeIds.includes(u.id))
    .map((u) => ({ id: u.id, name: u.name, department: u.department, jobTitle: u.jobTitle, supervisorId: u.supervisorId, supervisor: u.supervisor }));

  const subordinateIds = subordinates.map((s) => s.id);

  // Get FinalReviewConfig for calibration data
  const configRecord = await prisma.finalReviewConfig.findUnique({
    where: { cycleId: cycle.id },
  });
  const config = getFinalReviewConfigValue(
    cycle.id,
    configRecord ?? undefined,
    allUsers.map((u) => ({ id: u.id, name: u.name, department: u.department, role: u.role })),
  );

  // Batch fetch all data
  const [
    supervisorEvals,
    peerReviews,
    opinions,
    meetings,
    appliedSupervisorNormalization,
  ] = await Promise.all([
    prisma.supervisorEval.findMany({
      where: { cycleId: cycle.id, employeeId: { in: subordinateIds } },
      include: { evaluator: { select: { id: true, name: true } } },
    }),
    prisma.peerReview.findMany({
      where: { cycleId: cycle.id, revieweeId: { in: subordinateIds }, status: "SUBMITTED" },
      select: {
        revieweeId: true,
        reviewerId: true,
        reviewer: { select: { name: true } },
        performanceStars: true, performanceComment: true,
        comprehensiveStars: true, comprehensiveComment: true,
        learningStars: true, learningComment: true,
        adaptabilityStars: true, adaptabilityComment: true,
        candidStars: true, candidComment: true,
        progressStars: true, progressComment: true,
        altruismStars: true, altruismComment: true,
        rootStars: true, rootComment: true,
        outputScore: true, outputComment: true,
        collaborationScore: true, collaborationComment: true,
        valuesScore: true, valuesComment: true,
        innovationScore: true, innovationComment: true,
      },
    }),
    prisma.finalReviewOpinion.findMany({
      where: { cycleId: cycle.id, employeeId: { in: subordinateIds } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.meeting.findMany({
      where: { cycleId: cycle.id, supervisorId: user.id },
      include: { employee: { select: { id: true, name: true, department: true } } },
    }),
    getAppliedNormalizationMap(cycle.id, "SUPERVISOR_EVAL"),
  ]);

  // Build assignment map
  const assignments = buildSupervisorAssignmentMap(
    allUsers.map((u) => ({ id: u.id, name: u.name, supervisorId: u.supervisorId, supervisor: u.supervisor })),
    supervisorEvals.map((e) => ({ employeeId: e.employeeId, evaluatorId: e.evaluatorId, evaluatorName: e.evaluator.name })),
  );

  // Group data by employee
  const peerReviewsByEmployee = new Map<string, typeof peerReviews>();
  for (const review of peerReviews) {
    const list = peerReviewsByEmployee.get(review.revieweeId) || [];
    list.push(review);
    peerReviewsByEmployee.set(review.revieweeId, list);
  }

  const opinionsByEmployee = new Map<string, typeof opinions>();
  for (const opinion of opinions) {
    const list = opinionsByEmployee.get(opinion.employeeId) || [];
    list.push(opinion);
    opinionsByEmployee.set(opinion.employeeId, list);
  }

  const meetingsByEmployee = new Map(meetings.map((m) => [m.employeeId, m]));
  const usersById = new Map(allUsers.map((u) => [u.id, u]));
  const employeeOpinionActorIds = [...new Set(config.finalizerUserIds)].slice(0, 2);

  const items = subordinates.map((employee) => {
    const assignment = assignments.get(employee.id);

    // Supervisor eval
    const currentEvals = supervisorEvals.filter(
      (e) => e.employeeId === employee.id && Boolean(assignment?.currentEvaluatorIds.includes(e.evaluatorId)),
    );
    const scoredCurrentEvals = currentEvals.filter((e) => e.weightedScore != null);
    const weightedScore = scoredCurrentEvals.length > 0
      ? roundToOneDecimal(scoredCurrentEvals.reduce((sum, e) => sum + Number(e.weightedScore), 0) / scoredCurrentEvals.length)
      : null;
    const referenceStars = mapScoreToReferenceStars(weightedScore, config.referenceStarRanges);

    // Check normalization
    const normalizedSupervisor = appliedSupervisorNormalization.get(employee.id);
    const displayWeightedScore = normalizedSupervisor?.normalizedScore ?? weightedScore;
    const displayReferenceStars = normalizedSupervisor?.normalizedStars ?? referenceStars;

    // Official stars from calibration consensus
    const employeeOpinions = (opinionsByEmployee.get(employee.id) || []).filter(
      (o) => employeeOpinionActorIds.includes(o.reviewerId),
    );
    const consensus = resolveEmployeeConsensus(employeeOpinionActorIds, employeeOpinions);
    const officialStars = consensus.officialStars;
    const calibrated = officialStars != null && displayReferenceStars != null && officialStars !== displayReferenceStars;

    // Build calibration opinions for display
    const calibrationOpinions = employeeOpinionActorIds.map((reviewerId) => {
      const opinion = employeeOpinions.find((o) => o.reviewerId === reviewerId);
      const reviewer = usersById.get(reviewerId);
      return {
        reviewerId,
        reviewerName: reviewer?.name || "未知",
        decision: opinion?.decision || "PENDING",
        suggestedStars: opinion?.suggestedStars ?? null,
        reason: opinion?.reason || "",
      };
    });

    // Peer review summary
    const reviews = peerReviewsByEmployee.get(employee.id) || [];
    const categorySummary = buildPeerReviewCategorySummary(reviews);
    const peerReviewSummary = {
      ...categorySummary,
      count: reviews.length,
      reviews: reviews.map((review, index) => ({
        reviewerName: `匿名反馈 ${index + 1}`,
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
    };

    // Supervisor eval details (initial review)
    const primaryEval = currentEvals.find((e) => e.status === "SUBMITTED") || currentEvals[0] || null;
    const supervisorEvalDetail = primaryEval ? {
      evaluatorName: primaryEval.evaluator.name,
      status: primaryEval.status,
      weightedScore: primaryEval.weightedScore != null ? Number(primaryEval.weightedScore) : null,
      performanceStars: primaryEval.performanceStars,
      performanceComment: primaryEval.performanceComment,
      abilityStars: primaryEval.abilityStars,
      abilityComment: primaryEval.abilityComment,
      comprehensiveStars: primaryEval.comprehensiveStars,
      learningStars: primaryEval.learningStars,
      adaptabilityStars: primaryEval.adaptabilityStars,
      valuesStars: primaryEval.valuesStars,
      valuesComment: primaryEval.valuesComment,
      candidStars: primaryEval.candidStars,
      candidComment: primaryEval.candidComment,
      progressStars: primaryEval.progressStars,
      progressComment: primaryEval.progressComment,
      altruismStars: primaryEval.altruismStars,
      altruismComment: primaryEval.altruismComment,
      rootStars: primaryEval.rootStars,
      rootComment: primaryEval.rootComment,
    } : null;

    // Meeting data
    const meeting = meetingsByEmployee.get(employee.id);

    return {
      employee: {
        id: employee.id,
        name: employee.name,
        department: employee.department,
        jobTitle: employee.jobTitle,
      },
      peerReviewSummary,
      supervisorEval: supervisorEvalDetail,
      calibration: {
        displayWeightedScore,
        displayReferenceStars,
        officialStars,
        calibrated,
        opinions: calibrationOpinions,
      },
      meeting: meeting ? {
        id: meeting.id,
        summary: meeting.summary,
        notes: meeting.notes,
        supervisorCompleted: meeting.supervisorCompleted,
        employeeAck: meeting.employeeAck,
        meetingDate: meeting.meetingDate?.toISOString() ?? null,
      } : null,
    };
  });

  return {
    role: "SUPERVISOR",
    userRole: user.role,
    cycleStatus: cycle.status,
    cycleName: cycle.name,
    items,
  };
}

async function buildEmployeeData(
  user: { id: string; role: string; name: string },
  cycle: { id: string; name: string; status: string },
) {
  if (cycle.status !== "MEETING") {
    return { role: "EMPLOYEE", cycleStatus: cycle.status, cycleName: cycle.name, items: [] };
  }

  // Get all users for config resolution
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, department: true, role: true },
  });

  const configRecord = await prisma.finalReviewConfig.findUnique({
    where: { cycleId: cycle.id },
  });
  const config = getFinalReviewConfigValue(
    cycle.id,
    configRecord ?? undefined,
    allUsers.map((u) => ({ id: u.id, name: u.name, department: u.department, role: u.role })),
  );

  // Get calibration opinions for this employee
  const opinions = await prisma.finalReviewOpinion.findMany({
    where: { cycleId: cycle.id, employeeId: user.id },
  });

  const employeeOpinionActorIds = [...new Set(config.finalizerUserIds)].slice(0, 2);
  const filteredOpinions = opinions.filter((o) => employeeOpinionActorIds.includes(o.reviewerId));
  const consensus = resolveEmployeeConsensus(employeeOpinionActorIds, filteredOpinions);

  // Get meeting data
  const meeting = await prisma.meeting.findUnique({
    where: { cycleId_employeeId: { cycleId: cycle.id, employeeId: user.id } },
    include: { supervisor: { select: { id: true, name: true } } },
  });

  return {
    role: "EMPLOYEE",
    cycleStatus: cycle.status,
    cycleName: cycle.name,
    officialStars: consensus.officialStars,
    summary: meeting?.summary || "",
    employeeAck: meeting?.employeeAck || false,
    supervisorCompleted: meeting?.supervisorCompleted || false,
    meetingId: meeting?.id || null,
  };
}

// Create or update meeting
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["SUPERVISOR", "HRBP", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json();

    // Verify interviewer relationship (ADMIN exempt)
    if (user.role !== "ADMIN") {
      const allUsers = await prisma.user.findMany({
        select: { id: true, name: true, supervisorId: true, supervisor: { select: { id: true, name: true } } },
      });
      const interviewerMap = buildMeetingInterviewerMap(allUsers);
      const interviewerIds = interviewerMap.get(body.employeeId) || [];
      if (!interviewerIds.includes(user.id)) {
        return NextResponse.json({ error: "你不是该员工的绩效面谈人" }, { status: 403 });
      }
    }

    const cycle = await getActiveCycle();
    if (!cycle) {
      return NextResponse.json({ error: "No active cycle" }, { status: 400 });
    }

    const meeting = await prisma.meeting.upsert({
      where: {
        cycleId_employeeId: { cycleId: cycle.id, employeeId: body.employeeId },
      },
      update: {
        notes: body.notes ?? undefined,
        summary: body.summary ?? undefined,
        meetingDate: body.meetingDate ? new Date(body.meetingDate) : undefined,
      },
      create: {
        cycleId: cycle.id,
        employeeId: body.employeeId,
        supervisorId: user.id,
        notes: body.notes || "",
        summary: body.summary || "",
        meetingDate: body.meetingDate ? new Date(body.meetingDate) : null,
      },
    });

    return NextResponse.json(meeting);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
