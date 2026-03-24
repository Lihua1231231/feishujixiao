import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, getActiveCycle } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Return current user info for dashboard
    if (req.nextUrl.searchParams.get("me") === "true") {
      const cycle = await getActiveCycle();
      const pendingPeerReviews = await prisma.peerReview.count({
        where: { reviewerId: user.id, status: "DRAFT", ...(cycle ? { cycleId: cycle.id } : {}) },
      });
      const pendingTeamEvals = ["SUPERVISOR", "HRBP", "ADMIN"].includes(user.role)
        ? await prisma.user.count({ where: { supervisorId: user.id } })
        : 0;
      const hasAppeal = cycle ? await prisma.appeal.count({ where: { employeeId: user.id, cycleId: cycle.id } }) > 0 : false;
      return NextResponse.json({
        name: user.name,
        role: user.role,
        cycle: cycle ? { name: cycle.name, status: cycle.status } : null,
        pendingPeerReviews,
        pendingTeamEvals,
        hasAppeal,
      });
    }

    // Return all users (for peer review nomination etc.)
    const users = await prisma.user.findMany({
      select: { id: true, name: true, department: true },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
