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

// Delete a nomination (and associated PeerReview)
export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!APPROVERS.includes(user.name) && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { nominationId } = await req.json() as { nominationId: string };
    const nomination = await prisma.reviewerNomination.findUnique({ where: { id: nominationId } });
    if (!nomination) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Check if associated PeerReview has been submitted
    const pr = await prisma.peerReview.findFirst({
      where: {
        cycleId: nomination.cycleId,
        reviewerId: nomination.nomineeId,
        revieweeId: nomination.nominatorId,
        status: "SUBMITTED",
      },
    });
    if (pr) return NextResponse.json({ error: "该评估人已提交互评，无法删除" }, { status: 400 });

    // Delete associated PeerReview if exists (only draft/pending)
    await prisma.peerReview.deleteMany({
      where: {
        cycleId: nomination.cycleId,
        reviewerId: nomination.nomineeId,
        revieweeId: nomination.nominatorId,
      },
    });

    await prisma.reviewerNomination.delete({ where: { id: nominationId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// Admin add nomination for a user (auto-approved)
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!APPROVERS.includes(user.name) && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { nominatorId, nomineeId } = await req.json() as { nominatorId: string; nomineeId: string };
    if (!nominatorId || !nomineeId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const cycle = await prisma.reviewCycle.findFirst({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
    });
    if (!cycle) return NextResponse.json({ error: "No active cycle" }, { status: 400 });

    // Create nomination (auto-approved)
    const nomination = await prisma.reviewerNomination.create({
      data: {
        cycleId: cycle.id,
        nominatorId,
        nomineeId,
        supervisorStatus: "APPROVED",
        nomineeStatus: "PENDING",
      },
      include: {
        nominator: { select: { id: true, name: true, department: true } },
        nominee: { select: { id: true, name: true, department: true } },
      },
    });

    // Create PeerReview record
    await prisma.peerReview.upsert({
      where: {
        cycleId_reviewerId_revieweeId: {
          cycleId: cycle.id,
          reviewerId: nomineeId,
          revieweeId: nominatorId,
        },
      },
      update: {},
      create: { cycleId: cycle.id, reviewerId: nomineeId, revieweeId: nominatorId },
    });

    return NextResponse.json({
      id: nomination.id,
      nominator: nomination.nominator,
      nominee: nomination.nominee,
      supervisorStatus: nomination.supervisorStatus,
      nomineeStatus: nomination.nomineeStatus,
      createdAt: nomination.createdAt,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
