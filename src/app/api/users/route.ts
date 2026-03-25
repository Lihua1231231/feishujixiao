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
      const EVAL_LIST_NAMES = [
        "曹越","曹铭哲","欧阳伊希","窦雪茹","陈毅强","薛琳蕊","陈佳杰","刘一","张福强",
        "杨倩仪","莫颖儿","吕鸿","冉晨宇","张志权","赖永涛","江培章","陈家兴",
        "严骏","洪炯腾","沈楚城","张建生","戴智斌","马莘权","徐宗泽","龙辰",
        "胡毅薇","许斯荣","余一铭","曹文跃","李泽龙","禹聪琪","陈琼","李娟娟","刘瑞峰",
        "李斌琦","林义章","唐昊鸣","王金淋","洪思睿","叶荣金","郭雨明","邹玙璠","杨偲妤",
        "李红军","刘源源","顾元舜",
        "李晓霞","鲍建伟","郑文文","赵奇卓","宓鸿宇",
      ];
      const pendingTeamEvals = ["SUPERVISOR", "HRBP", "ADMIN"].includes(user.role)
        ? await prisma.user.count({ where: { supervisorId: user.id, name: { in: EVAL_LIST_NAMES } } })
        : 0;
      const hasAppeal = cycle ? await prisma.appeal.count({ where: { userId: user.id, cycleId: cycle.id } }) > 0 : false;
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
