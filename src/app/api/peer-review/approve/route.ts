import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

const APPROVERS = ["禹聪琪", "吴承霖", "邱翔", "陈琼"];

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

    const body = await req.json() as { nominationId?: string; nominationIds?: string[]; action: "approve" | "reject" };
    const { action } = body;

    // Support batch: nominationIds takes priority over nominationId
    const ids = body.nominationIds || (body.nominationId ? [body.nominationId] : []);
    if (ids.length === 0) return NextResponse.json({ error: "No nomination IDs" }, { status: 400 });

    const nominations = await prisma.reviewerNomination.findMany({
      where: { id: { in: ids }, supervisorStatus: "PENDING" },
    });

    let processed = 0;
    for (const nomination of nominations) {
      if (action === "approve") {
        await prisma.reviewerNomination.update({
          where: { id: nomination.id },
          data: { supervisorStatus: "APPROVED" },
        });
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
          where: { id: nomination.id },
          data: { supervisorStatus: "REJECTED" },
        });
      }
      processed++;
    }

    return NextResponse.json({ ok: true, processed });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
