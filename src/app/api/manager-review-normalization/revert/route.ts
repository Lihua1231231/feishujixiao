import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCycle, getSessionUser } from "@/lib/session";
import { canApplyScoreNormalization } from "@/lib/score-normalization-permissions";
import { revertManagerReviewNormalizationLayer } from "@/lib/manager-review-normalization";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    if (!canApplyScoreNormalization(user)) {
      return NextResponse.json({ error: "无权执行标准化回退" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { confirmed?: boolean };
    if (body.confirmed !== true) {
      return NextResponse.json({ error: "请先确认回退后将恢复原始分展示" }, { status: 400 });
    }

    const cycle = await getActiveCycle();
    if (!cycle) return NextResponse.json({ error: "当前无活动周期" }, { status: 404 });

    const result = revertManagerReviewNormalizationLayer({
      cycleId: cycle.id,
      revertedAt: new Date(),
    });

    const updated = await prisma.managerReviewNormalizationApplication.updateMany({
      where: {
        ...result.where,
        revertedAt: null,
      },
      data: {
        revertedAt: result.revertedAt,
        revertedById: user.id,
      },
    });

    return NextResponse.json({
      ok: true,
      cycle: { id: cycle.id, name: cycle.name },
      reverted: updated.count,
      applicationState: {
        workspaceState: "RAW",
        appliedAt: null,
        revertedAt: result.revertedAt.toISOString(),
        snapshotId: null,
        rollbackVisible: false,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
