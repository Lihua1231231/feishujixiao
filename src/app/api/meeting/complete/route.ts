import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, getActiveCycle } from "@/lib/session";
import { buildMeetingInterviewerMap, type DbInterviewerOverrides } from "@/lib/meeting-assignments";

function parseDbOverrides(raw: string | undefined | null): DbInterviewerOverrides {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["SUPERVISOR", "HRBP", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { employeeId, summary } = body;
    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    }
    if (!summary?.trim()) {
      return NextResponse.json({ error: "请填写绩效面谈综述后再标记完成" }, { status: 400 });
    }

    const cycle = await getActiveCycle();
    if (!cycle) {
      return NextResponse.json({ error: "No active cycle" }, { status: 400 });
    }

    // Verify interviewer relationship (ADMIN exempt)
    if (user.role !== "ADMIN") {
      const allUsers = await prisma.user.findMany({
        select: { id: true, name: true, supervisorId: true, supervisor: { select: { id: true, name: true } } },
      });
      let mc: { meetingInterviewerOverrides: string } | null = null;
      try {
        mc = await prisma.finalReviewConfig.findUnique({
          where: { cycleId: cycle.id },
          select: { meetingInterviewerOverrides: true },
        });
      } catch { /* column may not exist yet */ }
      const interviewerMap = buildMeetingInterviewerMap(allUsers, parseDbOverrides(mc?.meetingInterviewerOverrides));
      const interviewerIds = interviewerMap.get(employeeId) || [];
      if (!interviewerIds.includes(user.id)) {
        return NextResponse.json({ error: "你不是该员工的绩效面谈人" }, { status: 403 });
      }
    }

    const meeting = await prisma.meeting.upsert({
      where: {
        cycleId_employeeId: { cycleId: cycle.id, employeeId },
      },
      update: {
        summary: summary.trim(),
        supervisorCompleted: true,
      },
      create: {
        cycleId: cycle.id,
        employeeId,
        supervisorId: user.id,
        summary: summary.trim(),
        supervisorCompleted: true,
      },
    });

    return NextResponse.json(meeting);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
