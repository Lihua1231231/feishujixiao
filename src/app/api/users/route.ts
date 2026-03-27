import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, getActiveCycle } from "@/lib/session";
import { buildSupervisorAssignmentMap } from "@/lib/supervisor-assignments";
import { canAccessFinalReviewWorkspace } from "@/lib/final-review";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Return current user info for dashboard
    if (req.nextUrl.searchParams.get("me") === "true") {
      const cycle = await getActiveCycle();
      const pendingPeerReviews = await prisma.peerReview.count({
        where: {
          reviewerId: user.id,
          status: { notIn: ["SUBMITTED", "DECLINED"] },
          ...(cycle ? { cycleId: cycle.id } : {}),
        },
      });
      const pendingTeamEvals = ["SUPERVISOR", "HRBP", "ADMIN"].includes(user.role) && cycle
        ? await (async () => {
            const [allUsers, allSupervisorEvals] = await Promise.all([
              prisma.user.findMany({
                select: {
                  id: true,
                  name: true,
                  supervisorId: true,
                  supervisor: { select: { id: true, name: true } },
                },
              }),
              prisma.supervisorEval.findMany({
                where: { cycleId: cycle.id },
                include: {
                  evaluator: { select: { id: true, name: true } },
                },
              }),
            ]);

            const assignments = buildSupervisorAssignmentMap(
              allUsers,
              allSupervisorEvals.map((item) => ({
                employeeId: item.employeeId,
                evaluatorId: item.evaluatorId,
                evaluatorName: item.evaluator.name,
              }))
            );

            let count = 0;
            for (const assignment of assignments.values()) {
              if (!assignment.currentEvaluatorIds.includes(user.id)) continue;
              const myEval = allSupervisorEvals.find(
                (item) => item.employeeId === assignment.employeeId && item.evaluatorId === user.id
              );
              if (myEval?.status !== "SUBMITTED") {
                count++;
              }
            }
            return count;
          })()
        : 0;
      const hasAppeal = cycle ? await prisma.appeal.count({ where: { userId: user.id, cycleId: cycle.id } }) > 0 : false;
      const canAccessFinalReview = await canAccessFinalReviewWorkspace(user, cycle?.id);
      return NextResponse.json({
        name: user.name,
        role: user.role,
        cycle: cycle ? { name: cycle.name, status: cycle.status } : null,
        pendingPeerReviews,
        pendingTeamEvals,
        hasAppeal,
        canAccessFinalReview,
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
