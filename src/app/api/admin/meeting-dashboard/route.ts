import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, getActiveCycle } from "@/lib/session";
import {
  buildMeetingInterviewerMap,
  isDbOverridden,
  type DbInterviewerOverrides,
} from "@/lib/meeting-assignments";

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

    const [allUsers, meetings] = await Promise.all([
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
    ]);

    let config: { meetingInterviewerOverrides: string } | null = null;
    try {
      config = await prisma.finalReviewConfig.findUnique({
        where: { cycleId: cycle.id },
        select: { meetingInterviewerOverrides: true },
      });
    } catch { /* column may not exist yet */ }

    const dbOverrides = getDbOverrides(config);
    const interviewerMap = buildMeetingInterviewerMap(allUsers, dbOverrides);
    const usersById = new Map(allUsers.map((u) => [u.id, u]));
    const meetingsByEmployee = new Map(meetings.map((m) => [m.employeeId, m]));

    const employees = allUsers
      .filter((u) => u.role === "EMPLOYEE" || u.role === "SUPERVISOR")
      .map((u) => {
        const interviewerIds = interviewerMap.get(u.id) || [];
        const interviewerNames = interviewerIds
          .map((id) => usersById.get(id)?.name)
          .filter(Boolean) as string[];

        const meeting = meetingsByEmployee.get(u.id);
        let meetingStatus: "pending" | "completed" | "acked" = "pending";
        if (meeting?.employeeAck) meetingStatus = "acked";
        else if (meeting?.supervisorCompleted) meetingStatus = "completed";

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
