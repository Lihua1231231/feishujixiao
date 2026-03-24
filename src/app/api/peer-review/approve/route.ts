import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

const APPROVERS = ["禹聪琪", "吴承霖", "邱翔"];

// Get all pending nominations for approval
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!APPROVERS.includes(user.name) && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cycle = await prisma.reviewCycle.findFirst({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
    });
    if (!cycle) return NextResponse.json([]);

    const nominations = await prisma.reviewerNomination.findMany({
      where: { cycleId: cycle.id },
      include: {
        nominator: { select: { id: true, name: true, department: true } },
        nominee: { select: { id: true, name: true, department: true } },
      },
      orderBy: [{ supervisorStatus: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(nominations.map(n => ({
      id: n.id,
      nominator: n.nominator,
      nominee: n.nominee,
      supervisorStatus: n.supervisorStatus,
      nomineeStatus: n.nomineeStatus,
      createdAt: n.createdAt,
    })));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// Approve or reject a nomination
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!APPROVERS.includes(user.name) && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { nominationId, action } = await req.json() as { nominationId: string; action: "approve" | "reject" };

    const nomination = await prisma.reviewerNomination.findUnique({
      where: { id: nominationId },
    });
    if (!nomination) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (action === "approve") {
      await prisma.reviewerNomination.update({
        where: { id: nominationId },
        data: { supervisorStatus: "APPROVED" },
      });

      // Create PeerReview record for the nominee to fill
      await prisma.peerReview.upsert({
        where: {
          cycleId_reviewerId_revieweeId: {
            cycleId: nomination.cycleId,
            reviewerId: nomination.nomineeId,
            revieweeId: nomination.nominatorId,
          },
        },
        update: {},
        create: {
          cycleId: nomination.cycleId,
          reviewerId: nomination.nomineeId,
          revieweeId: nomination.nominatorId,
        },
      });
    } else {
      await prisma.reviewerNomination.update({
        where: { id: nominationId },
        data: { supervisorStatus: "REJECTED" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
