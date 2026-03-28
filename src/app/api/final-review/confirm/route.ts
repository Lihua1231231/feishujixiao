import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCycle, getSessionUser } from "@/lib/session";
import { getFinalReviewConfigValue, isOrdinaryEmployeeFinalReviewSubject } from "@/lib/final-review";
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
    const referenceStars = validateStars(body.referenceStars);
    if (officialStars == null) {
      return NextResponse.json({ error: "officialStars must be between 1 and 5" }, { status: 400 });
    }

    const configRecord = await prisma.finalReviewConfig.findUnique({ where: { cycleId: cycle.id } });
    const config = getFinalReviewConfigValue(cycle.id, configRecord);
    const canFinalize = user.role === "ADMIN" || config.finalizerUserIds.includes(user.id);
    if (!canFinalize) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isOrdinaryEmployeeFinalReviewSubject(config, body.userId)) {
      return NextResponse.json({ error: "该员工不在普通员工终评名单中" }, { status: 400 });
    }

    const reason = sanitizeText(body.reason);
    if (referenceStars != null && officialStars !== referenceStars && !reason) {
      return NextResponse.json({ error: "官方星级不同于参考星级时必须填写理由" }, { status: 400 });
    }

    const [confirmation] = await prisma.$transaction([
      prisma.finalReviewConfirmation.create({
        data: {
          cycleId: cycle.id,
          userId: body.userId,
          confirmerId: user.id,
          scope: "EMPLOYEE",
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
