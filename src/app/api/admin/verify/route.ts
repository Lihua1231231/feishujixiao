import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

const EVAL_LIST_NAMES = [
  "曹越","曹铭哲","欧阳伊希","窦雪茹","陈毅强","薛琳蕊","陈佳杰","刘一","张福强",
  "杨倩仪","莫颖儿","吕鸿","冉晨宇","张志权","赖永涛","江培章","陈家兴",
  "严骏","洪炯腾","沈楚城","张建生","戴智斌","马莘权","徐宗泽","龙辰",
  "胡毅薇","许斯荣","余一铭","曹文跃","李泽龙","禹聪琪","陈琼","李娟娟","刘瑞峰",
  "李斌琦","林义章","唐昊鸣","王金淋","洪思睿","叶荣金","郭雨明","邹玙璠","杨偲妤",
  "李红军","刘源源","顾元舜",
  // Group B
  "李晓霞","鲍建伟","郑文文","赵奇卓","宓鸿宇",
];

const GROUP_B = ["李晓霞","鲍建伟","郑文文","赵奇卓","宓鸿宇"];

const EXTRA_EVAL_MAP: Record<string, string[]> = {
  "吴承霖": ["曹铭哲", "邱翔", "张东杰", "冉晨宇", "张志权", "徐宗泽", "李泽龙", "禹聪琪", "李斌琦", "王金淋", "赵奇卓"],
  "邱翔": ["曹铭哲", "张东杰", "冉晨宇", "张志权", "徐宗泽", "李泽龙", "禹聪琪", "李斌琦", "王金淋", "赵奇卓"],
  "张东杰": ["余一铭", "曹文跃", "胡毅薇", "许斯荣", "刘瑞峰"],
  "冉晨宇": ["邹玙璠"],
  "李娟娟": ["郭雨明"],
};

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const cycle = await prisma.reviewCycle.findFirst({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
    });
    if (!cycle) return NextResponse.json({ error: "No active cycle" }, { status: 400 });

    // All users with supervisor info
    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, department: true, role: true, supervisorId: true, supervisor: { select: { name: true } } },
    });
    const userByName = new Map(allUsers.map(u => [u.name, u]));

    // Self evaluations
    const selfEvals = await prisma.selfEvaluation.findMany({
      where: { cycleId: cycle.id },
      select: { userId: true, status: true, sourceUrl: true, importedContent: true },
    });
    const selfEvalByUserId = new Map(selfEvals.map(s => [s.userId, s]));

    // Nominations (as nominator)
    const nominations = await prisma.reviewerNomination.findMany({
      where: { cycleId: cycle.id },
      select: { nominatorId: true, supervisorStatus: true, nomineeStatus: true },
    });
    // Group by nominator
    const nomsByNominator = new Map<string, { total: number; approved: number; pending: number; rejected: number }>();
    for (const n of nominations) {
      const cur = nomsByNominator.get(n.nominatorId) || { total: 0, approved: 0, pending: 0, rejected: 0 };
      cur.total++;
      if (n.supervisorStatus === "APPROVED") cur.approved++;
      else if (n.supervisorStatus === "PENDING") cur.pending++;
      else if (n.supervisorStatus === "REJECTED") cur.rejected++;
      nomsByNominator.set(n.nominatorId, cur);
    }

    // Peer reviews (as reviewee)
    const peerReviews = await prisma.peerReview.findMany({
      where: { cycleId: cycle.id },
      select: { revieweeId: true, status: true },
    });
    const peerByReviewee = new Map<string, { total: number; submitted: number }>();
    for (const p of peerReviews) {
      const cur = peerByReviewee.get(p.revieweeId) || { total: 0, submitted: 0 };
      cur.total++;
      if (p.status === "SUBMITTED") cur.submitted++;
      peerByReviewee.set(p.revieweeId, cur);
    }

    // Supervisor evals
    const supEvals = await prisma.supervisorEval.findMany({
      where: { cycleId: cycle.id },
      select: { employeeId: true, evaluatorId: true, status: true },
    });
    const supEvalByEmployee = new Map<string, { evaluatorId: string; status: string }[]>();
    for (const e of supEvals) {
      const cur = supEvalByEmployee.get(e.employeeId) || [];
      cur.push({ evaluatorId: e.evaluatorId, status: e.status });
      supEvalByEmployee.set(e.employeeId, cur);
    }

    // Build roster verification rows
    const roster = EVAL_LIST_NAMES.map(name => {
      const u = userByName.get(name);
      const isGroupB = GROUP_B.includes(name);
      if (!u) {
        return { name, inSystem: false, isGroupB, department: null, supervisor: null, selfEval: null, nominations: null, peerReview: null, supEval: null };
      }
      const se = selfEvalByUserId.get(u.id);
      const noms = nomsByNominator.get(u.id);
      const peer = peerByReviewee.get(u.id);
      const evals = supEvalByEmployee.get(u.id);

      // Find evaluators for this person
      const evaluators: string[] = [];
      // Direct supervisor
      if (u.supervisor) evaluators.push(u.supervisor.name);
      // Extra evaluators (including 吴承霖/邱翔 for specific people)
      for (const [supName, targets] of Object.entries(EXTRA_EVAL_MAP)) {
        if (targets.includes(name) && supName !== u.supervisor?.name) {
          evaluators.push(supName);
        }
      }

      return {
        name,
        inSystem: true,
        isGroupB,
        department: u.department,
        role: u.role,
        supervisor: u.supervisor?.name || null,
        selfEval: se ? { status: se.status, hasUrl: !!se.sourceUrl, hasContent: !!(se.importedContent && se.importedContent.length > 0), sourceUrl: se.sourceUrl } : null,
        nominations: noms || { total: 0, approved: 0, pending: 0, rejected: 0 },
        peerReview: peer || { total: 0, submitted: 0 },
        supEval: evals?.map(e => {
          const evaluator = allUsers.find(u2 => u2.id === e.evaluatorId);
          return { evaluator: evaluator?.name || "unknown", status: e.status };
        }) || [],
        expectedEvaluators: evaluators,
      };
    });

    // Summary stats
    const inSystemCount = roster.filter(r => r.inSystem).length;
    const missingCount = roster.filter(r => !r.inSystem).length;
    const groupACount = roster.filter(r => !r.isGroupB).length;
    const selfEvalDone = roster.filter(r => r.inSystem && !r.isGroupB && r.selfEval?.hasUrl).length;
    const selfEvalMissing = groupACount - selfEvalDone;
    const nominated = roster.filter(r => r.inSystem && r.nominations && r.nominations.total >= 3).length;
    const supEvalSubmitted = roster.filter(r => r.inSystem && Array.isArray(r.supEval) && r.supEval.some(e => e.status === "SUBMITTED")).length;

    return NextResponse.json({
      cycleId: cycle.id,
      cycleName: cycle.name,
      cycleStatus: cycle.status,
      summary: {
        total: EVAL_LIST_NAMES.length,
        inSystem: inSystemCount,
        missing: missingCount,
        groupA: groupACount,
        groupB: GROUP_B.length,
        selfEvalDone,
        selfEvalMissing,
        nominated,
        supEvalSubmitted,
      },
      roster,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
