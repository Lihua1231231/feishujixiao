import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, getActiveCycle } from "@/lib/session";

// Get current user's nominations
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const cycle = await prisma.reviewCycle.findFirst({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
    });
    if (!cycle) return NextResponse.json([]);

    const nominations = await prisma.reviewerNomination.findMany({
      where: { cycleId: cycle.id, nominatorId: user.id },
      include: { nominee: { select: { id: true, name: true, department: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      nominations.map((n) => ({
        id: n.id,
        nominee: n.nominee,
        supervisorStatus: n.supervisorStatus,
        nomineeStatus: n.nomineeStatus,
      }))
    );
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// Create nominations
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 周期阶段验证（ADMIN豁免）
    if (user.role !== "ADMIN") {
      const cycle = await getActiveCycle();
      if (!cycle || (cycle.status !== "SELF_EVAL" && cycle.status !== "PEER_REVIEW")) {
        return NextResponse.json({ error: "当前不在自评或互评阶段，无法执行此操作" }, { status: 400 });
      }
    }

    const body = await req.json();
    let { nomineeIds } = body as { nomineeIds: string[] };

    // Filter out self-nomination
    nomineeIds = nomineeIds.filter((id) => id !== user.id);

    if (nomineeIds.length < 3) {
      return NextResponse.json({ error: "请至少提名3位同事" }, { status: 400 });
    }

    const cycle = await prisma.reviewCycle.findFirst({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
    });
    if (!cycle) {
      return NextResponse.json({ error: "No active cycle" }, { status: 400 });
    }

    // Delete existing nominations for this user in this cycle
    await prisma.reviewerNomination.deleteMany({
      where: { cycleId: cycle.id, nominatorId: user.id },
    });

    // Create new nominations (pending approval by HR/admin)
    const nominations = await Promise.all(
      nomineeIds.map(async (nomineeId) => {
        const nom = await prisma.reviewerNomination.create({
          data: {
            cycleId: cycle.id,
            nominatorId: user.id,
            nomineeId,
            supervisorStatus: "PENDING",
            nomineeStatus: "PENDING",
          },
          include: { nominee: { select: { id: true, name: true, department: true } } },
        });
        // PeerReview record will be created when nomination is approved
        return nom;
      })
    );

    return NextResponse.json(
      nominations.map((n) => ({
        id: n.id,
        nominee: n.nominee,
        supervisorStatus: n.supervisorStatus,
        nomineeStatus: n.nomineeStatus,
      }))
    );
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
