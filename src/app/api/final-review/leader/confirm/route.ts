import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCycle, getSessionUser } from "@/lib/session";
import { getFinalReviewConfigValue, isLeaderFinalReviewReady } from "@/lib/final-review";
import { sanitizeText, validateStars } from "@/lib/validate";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const cycle = await getActiveCycle();
    if (!cycle) return NextResponse.json({ error: "No active cycle" }, { status: 400 });
    if (user.role !== "ADMIN" && cycle.status !== "CALIBRATION") {
      return NextResponse.json({ error: "当前不在终评阶段，无法执行此操作" }, { status: 400 });
    }

    const body = await req.json();
    if (!body?.userId || typeof body.userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const officialStars = validateStars(body.officialStars);
    const reason = sanitizeText(body.reason);
    if (officialStars == null) {
      return NextResponse.json({ error: "officialStars must be between 1 and 5" }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ error: "主管层最终确认理由必填" }, { status: 400 });
    }

    const configRecord = await prisma.finalReviewConfig.findUnique({ where: { cycleId: cycle.id } });
    const config = getFinalReviewConfigValue(cycle.id, configRecord);
    const canFinalize = user.role === "ADMIN" || config.finalizerUserIds.includes(user.id);
    if (!canFinalize) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allReviews = await prisma.leaderFinalReview.findMany({
      where: { cycleId: cycle.id, employeeId: body.userId },
      select: { evaluatorId: true, status: true },
    });
    const isReady = isLeaderFinalReviewReady(config, allReviews);
    if (!isReady) {
      return NextResponse.json({ error: "主管层双人终评尚未全部提交" }, { status: 400 });
    }

    const [confirmation] = await prisma.$transaction([
      prisma.finalReviewConfirmation.create({
        data: {
          cycleId: cycle.id,
          userId: body.userId,
          confirmerId: user.id,
          scope: "LEADER",
          officialStars,
          reason,
        },
      }),
      prisma.calibrationResult.upsert({
        where: {
          cycleId_userId: {
            cycleId: cycle.id,
            userId: body.userId,
          },
        },
        update: {
          finalStars: officialStars,
          adjustedBy: user.name,
          adjustReason: reason,
        },
        create: {
          cycleId: cycle.id,
          userId: body.userId,
          finalStars: officialStars,
          adjustedBy: user.name,
          adjustReason: reason,
        },
      }),
    ]);

    return NextResponse.json(confirmation);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
