import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, getActiveCycle } from "@/lib/session";
import {
  buildMeetingInterviewerMap,
  isDbOverridden,
  type DbInterviewerOverrides,
} from "@/lib/meeting-assignments";
import { getFinalReviewConfigValue, mapScoreToReferenceStars } from "@/lib/final-review";
import { resolveEmployeeConsensus } from "@/lib/final-review-logic";
import { buildSupervisorAssignmentMap } from "@/lib/supervisor-assignments";
import { getAppliedNormalizationMap } from "@/lib/applied-normalization";
import { resolveFinalStars } from "@/lib/resolve-final-stars";

function getDbOverrides(config: { meetingInterviewerOverrides: string } | null): DbInterviewerOverrides {
  if (!config?.meetingInterviewerOverrides) return {};
  try {
    return JSON.parse(config.meetingInterviewerOverrides);
  } catch {
    return {};
  }
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cycle = await getActiveCycle();
    if (!cycle) {
      return NextResponse.json({ error: "No active cycle" }, { status: 400 });
    }

    const [allUsers, meetings, supervisorEvals, opinions] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true, name: true, department: true, role: true,
          supervisorId: true,
          supervisor: { select: { id: true, name: true } },
        },
      }),
      prisma.meeting.findMany({
        where: { cycleId: cycle.id },
      }),
      prisma.supervisorEval.findMany({
        where: { cycleId: cycle.id },
        include: { evaluator: { select: { id: true, name: true } } },
      }),
      prisma.finalReviewOpinion.findMany({
        where: { cycleId: cycle.id },
      }),
    ]);

    let config: { meetingInterviewerOverrides: string } | null = null;
    const configRecord = await prisma.finalReviewConfig.findUnique({
      where: { cycleId: cycle.id },
    });
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config = configRecord ? { meetingInterviewerOverrides: (configRecord as any).meetingInterviewerOverrides || "{}" } : null;
    } catch { config = null; }

    const fullConfig = getFinalReviewConfigValue(
      cycle.id,
      configRecord ?? undefined,
      allUsers.map((u) => ({ id: u.id, name: u.name, department: u.department, role: u.role })),
    );

    // Build assignment map for referenceStars computation
    const assignments = buildSupervisorAssignmentMap(
      allUsers.map((u) => ({ id: u.id, name: u.name, supervisorId: u.supervisorId, supervisor: u.supervisor })),
      supervisorEvals.map((e) => ({ employeeId: e.employeeId, evaluatorId: e.evaluatorId, evaluatorName: e.evaluator.name })),
    );
    const appliedNorm = await getAppliedNormalizationMap(cycle.id, "SUPERVISOR_EVAL");

    // Group opinions by employee
    const employeeOpinionActorIds = [...new Set(fullConfig.finalizerUserIds)].slice(0, 2);
    const opinionsByEmployee = new Map<string, typeof opinions>();
    for (const op of opinions) {
      const list = opinionsByEmployee.get(op.employeeId) || [];
      list.push(op);
      opinionsByEmployee.set(op.employeeId, list);
    }

    // Group supervisor evals by employee
    const evalsByEmployee = new Map<string, typeof supervisorEvals>();
    for (const ev of supervisorEvals) {
      const list = evalsByEmployee.get(ev.employeeId) || [];
      list.push(ev);
      evalsByEmployee.set(ev.employeeId, list);
    }

    const dbOverrides = getDbOverrides(config);
    const interviewerMap = buildMeetingInterviewerMap(allUsers, dbOverrides);
    const usersById = new Map(allUsers.map((u) => [u.id, u]));
    const meetingsByEmployee = new Map(meetings.map((m) => [m.employeeId, m]));

    const employees = allUsers
      .filter((u) => interviewerMap.has(u.id))
      .map((u) => {
        const interviewerIds = interviewerMap.get(u.id) || [];
        const interviewerNames = interviewerIds
          .map((id) => usersById.get(id)?.name)
          .filter(Boolean) as string[];

        const meeting = meetingsByEmployee.get(u.id);
        let meetingStatus: "pending" | "completed" | "acked" = "pending";
        if (meeting?.employeeAck) meetingStatus = "acked";
        else if (meeting?.supervisorCompleted) meetingStatus = "completed";

        // Compute finalStars using shared logic (same as archive-tables)
        const assignment = assignments.get(u.id);
        const empEvals = evalsByEmployee.get(u.id) || [];
        const currentEvals = empEvals.filter(
          (e) => Boolean(assignment?.currentEvaluatorIds.includes(e.evaluatorId)),
        );
        const scoredEvals = currentEvals.filter((e) => e.weightedScore != null);
        const weightedScore = scoredEvals.length > 0
          ? scoredEvals.reduce((sum, e) => sum + Number(e.weightedScore), 0) / scoredEvals.length
          : null;
        const rawRefStars = mapScoreToReferenceStars(weightedScore, fullConfig.referenceStarRanges);
        const norm = appliedNorm.get(u.id);
        const referenceStars = norm?.normalizedStars ?? rawRefStars;

        const empOpinions = (opinionsByEmployee.get(u.id) || [])
          .filter((o) => employeeOpinionActorIds.includes(o.reviewerId));
        const consensus = resolveEmployeeConsensus(employeeOpinionActorIds, empOpinions);
        const opinionsWithNames = empOpinions.map((o) => ({
          reviewerName: usersById.get(o.reviewerId)?.name || "",
          decision: o.decision,
          suggestedStars: o.suggestedStars,
        }));
        const finalStars = resolveFinalStars(opinionsWithNames, referenceStars, consensus.officialStars);

        return {
          id: u.id,
          name: u.name,
          department: u.department,
          supervisorName: u.supervisor?.name ?? "—",
          interviewerNames,
          interviewerIds,
          meetingStatus,
          summary: meeting?.summary || "",
          isOverridden: isDbOverridden(u.name, dbOverrides),
          finalStars,
        };
      })
      .sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));

    const allSupervisors = allUsers
      .filter((u) => ["SUPERVISOR", "HRBP", "ADMIN"].includes(u.role))
      .map((u) => ({ id: u.id, name: u.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      cycleName: cycle.name,
      employees,
      allSupervisors,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cycle = await getActiveCycle();
    if (!cycle) {
      return NextResponse.json({ error: "No active cycle" }, { status: 400 });
    }

    const body = await req.json();
    const { employeeName, interviewerNames } = body as {
      employeeName: string;
      interviewerNames: string[];
    };

    if (!employeeName || !Array.isArray(interviewerNames) || interviewerNames.length === 0) {
      return NextResponse.json({ error: "employeeName and interviewerNames required" }, { status: 400 });
    }

    const config = await prisma.finalReviewConfig.findUnique({
      where: { cycleId: cycle.id },
    });

    if (!config) {
      return NextResponse.json({ error: "FinalReviewConfig not found for this cycle" }, { status: 400 });
    }

    const overrides = getDbOverrides(config);
    overrides[employeeName] = interviewerNames;

    await prisma.finalReviewConfig.update({
      where: { cycleId: cycle.id },
      data: { meetingInterviewerOverrides: JSON.stringify(overrides) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
