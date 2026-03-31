import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  revertScoreNormalizationLayer,
  type ScoreNormalizationSource,
} from "@/lib/score-normalization";
import { canApplyScoreNormalization } from "@/lib/score-normalization-permissions";
import { getActiveCycle, getSessionUser } from "@/lib/session";
import type { ScoreNormalizationRevertRequest } from "@/components/score-normalization/types";

function resolveSource(request: NextRequest, body: ScoreNormalizationRevertRequest): ScoreNormalizationSource {
  const source = body.source ?? request.nextUrl.searchParams.get("source");
  return source === "SUPERVISOR_EVAL" ? "SUPERVISOR_EVAL" : "PEER_REVIEW";
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    if (!canApplyScoreNormalization(user)) return NextResponse.json({ error: "无权执行标准化回退" }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as ScoreNormalizationRevertRequest;
    if (body.confirmed !== true) {
      return NextResponse.json({ error: "请先确认回退后将恢复原始分展示" }, { status: 400 });
    }

    const cycle = await getActiveCycle();
    if (!cycle) return NextResponse.json({ error: "当前无活动周期" }, { status: 404 });

    const source = resolveSource(request, body);
    const result = revertScoreNormalizationLayer({
      cycleId: cycle.id,
      source,
      revertedAt: new Date(),
    });

    const updated = await prisma.scoreNormalizationApplication.updateMany({
      where: {
        ...result.where,
        revertedAt: null,
      },
      data: {
        revertedAt: result.revertedAt,
      },
    });

    return NextResponse.json({
      ok: true,
      cycle: { id: cycle.id, name: cycle.name },
      source,
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
