import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, getActiveCycle } from "@/lib/session";
import { sanitizeText, validateStars } from "@/lib/validate";

// Get team evaluations for supervisor
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["SUPERVISOR", "HRBP", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const cycle = await prisma.reviewCycle.findFirst({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
    });
    if (!cycle) return NextResponse.json([]);

    // 考核名单 48 人（王煦晖已离职，移除）
    const EVAL_LIST_NAMES = [
      "曹越","曹铭哲","欧阳伊希","窦雪茹","陈毅强","薛琳蕊","陈佳杰","刘一","张福强",
      "杨倩仪","莫颖儿","吕鸿","冉晨宇","张志权","赖永涛","江培章","陈家兴",
      "严骏","洪炯腾","沈楚城","张建生","戴智斌","马莘权","徐宗泽","龙辰",
      "胡毅薇","许斯荣","余一铭","曹文跃","李泽龙","禹聪琪","陈琼","李娟娟","刘瑞峰",
      "李斌琦","林义章","唐昊鸣","王金淋","洪思睿","叶荣金","郭雨明","邹玙璠","杨偲妤",
      "李红军","刘源源","顾元舜",
      // Group B：新入职，不自评但参与360+初评
      "李晓霞","鲍建伟","郑文文","赵奇卓","宓鸿宇",
    ];

    // 额外评估映射：某些主管需要额外评估非直属下级
    const EXTRA_EVAL_MAP: Record<string, string[]> = {
      "吴承霖": ["曹铭哲", "邱翔", "张东杰", "冉晨宇", "张志权", "徐宗泽", "李泽龙", "禹聪琪", "李斌琦", "王金淋", "赵奇卓"],
      "邱翔": ["曹铭哲", "张东杰", "冉晨宇", "张志权", "徐宗泽", "李泽龙", "禹聪琪", "李斌琦", "王金淋", "赵奇卓"],
      "张东杰": ["余一铭", "曹文跃", "胡毅薇", "许斯荣"],
      "张志权": ["刘瑞峰"],
      "冉晨宇": ["邹玙璠"],                                   // 邹玙璠双评
      "李娟娟": ["郭雨明"],                                    // 郭雨明双评
    };

    // 所有主管统一逻辑：(直属下级 ∩ 考核名单) ∪ 额外评估人员
    const extraNames = EXTRA_EVAL_MAP[user.name] || [];
    let subordinateWhere: object;
    if (extraNames.length > 0) {
      subordinateWhere = { AND: [{ id: { not: user.id } }, { OR: [{ AND: [{ supervisorId: user.id }, { name: { in: EVAL_LIST_NAMES } }] }, { name: { in: extraNames } }] }] };
    } else {
      subordinateWhere = { AND: [{ supervisorId: user.id }, { name: { in: EVAL_LIST_NAMES } }] };
    }

    const subordinates = await prisma.user.findMany({
      where: subordinateWhere,
      select: { id: true, name: true, department: true, jobTitle: true },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    });

    const evals = await Promise.all(
      subordinates.map(async (sub) => {
        const eval_ = await prisma.supervisorEval.findUnique({
          where: { cycleId_employeeId: { cycleId: cycle.id, employeeId: sub.id } },
        });

        const selfEval = await prisma.selfEvaluation.findUnique({
          where: { cycleId_userId: { cycleId: cycle.id, userId: sub.id } },
        });

        const peerReviews = await prisma.peerReview.findMany({
          where: { cycleId: cycle.id, revieweeId: sub.id, status: "SUBMITTED" },
          select: {
            outputScore: true, outputComment: true,
            collaborationScore: true, collaborationComment: true,
            valuesScore: true, valuesComment: true,
            innovationScore: true, innovationComment: true,
          },
        });

        // 查询预期评估人数（该员工提名且被接受的数量）
        const expectedCount = await prisma.reviewerNomination.count({
          where: { cycleId: cycle.id, nominatorId: sub.id, nomineeStatus: "ACCEPTED" },
        });

        const avgPeer = {
          output: peerReviews.length > 0 ? peerReviews.reduce((s, r) => s + (r.outputScore || 0), 0) / peerReviews.length : 0,
          collaboration: peerReviews.length > 0 ? peerReviews.reduce((s, r) => s + (r.collaborationScore || 0), 0) / peerReviews.length : 0,
          values: peerReviews.length > 0 ? peerReviews.reduce((s, r) => s + (r.valuesScore || 0), 0) / peerReviews.length : 0,
          count: peerReviews.length,
          expectedCount,
          reviews: peerReviews,
        };

        return {
          employee: sub,
          evaluation: eval_,
          selfEval: selfEval ? { status: selfEval.status, importedContent: selfEval.importedContent, sourceUrl: selfEval.sourceUrl } : null,
          peerReviewSummary: avgPeer,
        };
      })
    );

    return NextResponse.json(evals);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

function computeWeightedScore(performanceStars: number | null, abilityStars: number | null, valuesStars: number | null): number | null {
  if (performanceStars == null || abilityStars == null || valuesStars == null) return null;
  return performanceStars * 0.5 + abilityStars * 0.3 + valuesStars * 0.2;
}

// Create or update supervisor evaluation
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["SUPERVISOR", "HRBP", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json();

    const cycle = await getActiveCycle();
    if (!cycle) {
      return NextResponse.json({ error: "No active cycle" }, { status: 400 });
    }

    // 周期阶段验证（ADMIN豁免）
    if (user.role !== "ADMIN" && cycle.status !== "SUPERVISOR_EVAL") {
      return NextResponse.json({ error: "当前不在上级评估阶段，无法执行此操作" }, { status: 400 });
    }

    // 上下级关系验证（ADMIN豁免，额外评估映射豁免）
    const EXTRA_EVAL_MAP_POST: Record<string, string[]> = {
      "吴承霖": ["曹铭哲", "邱翔", "张东杰", "冉晨宇", "张志权", "徐宗泽", "李泽龙", "禹聪琪", "李斌琦", "王金淋", "赵奇卓"],
      "邱翔": ["曹铭哲", "张东杰", "冉晨宇", "张志权", "徐宗泽", "李泽龙", "禹聪琪", "李斌琦", "王金淋", "赵奇卓"],
      "张东杰": ["余一铭", "曹文跃", "胡毅薇", "许斯荣"],
      "张志权": ["刘瑞峰"],
      "冉晨宇": ["邹玙璠"],
      "李娟娟": ["郭雨明"],
    };
    if (user.role !== "ADMIN") {
      const employee = await prisma.user.findUnique({ where: { id: body.employeeId } });
      const extraNames = EXTRA_EVAL_MAP_POST[user.name] || [];
      const isExtraTarget = employee && extraNames.includes(employee.name);
      if (!employee || (employee.supervisorId !== user.id && !isExtraTarget)) {
        return NextResponse.json({ error: "你不是该员工的直属上级" }, { status: 403 });
      }
    }

    const isSubmit = body.action === "submit";

    // Submission lock: prevent modifying already submitted eval
    const existingEval = await prisma.supervisorEval.findUnique({
      where: { cycleId_employeeId: { cycleId: cycle.id, employeeId: body.employeeId } },
    });
    if (existingEval?.status === "SUBMITTED") {
      return NextResponse.json({ error: "已提交，无法修改" }, { status: 400 });
    }

    const performanceStars = validateStars(body.performanceStars);
    const comprehensiveStars = validateStars(body.comprehensiveStars);
    const learningStars = validateStars(body.learningStars);
    const adaptabilityStars = validateStars(body.adaptabilityStars);
    // 个人能力 = 综合能力:学习能力:适应能力 = 1:1:1
    const abilityStars = (comprehensiveStars != null && learningStars != null && adaptabilityStars != null)
      ? Math.round((comprehensiveStars + learningStars + adaptabilityStars) / 3)
      : null;
    // 价值观 = 坦诚真实:极致进取:成就利他:ROOT = 1:1:1:1
    const candidStars = validateStars(body.candidStars);
    const progressStars = validateStars(body.progressStars);
    const altruismStars = validateStars(body.altruismStars);
    const rootStars = validateStars(body.rootStars);
    const valuesStars = (candidStars != null && progressStars != null && altruismStars != null && rootStars != null)
      ? Math.round((candidStars + progressStars + altruismStars + rootStars) / 4)
      : null;
    const weightedScore = computeWeightedScore(performanceStars, abilityStars, valuesStars);

    if (isSubmit) {
      if (!performanceStars || !comprehensiveStars || !learningStars || !adaptabilityStars || !candidStars || !progressStars || !altruismStars || !rootStars) {
        return NextResponse.json({ error: "请完成所有维度的星级评分" }, { status: 400 });
      }
      const pc = sanitizeText(body.performanceComment);
      const ac = sanitizeText(body.abilityComment);
      const cc = sanitizeText(body.candidComment);
      const prc = sanitizeText(body.progressComment);
      const alc = sanitizeText(body.altruismComment);
      const rc = sanitizeText(body.rootComment);
      if (!pc || !ac || !cc || !prc || !alc || !rc) {
        return NextResponse.json({ error: "请填写所有维度的文字评语" }, { status: 400 });
      }
    }

    const abilityData = {
      abilityStars,
      abilityComment: sanitizeText(body.abilityComment),
      comprehensiveStars,
      learningStars,
      adaptabilityStars,
    };

    const valuesData = {
      valuesStars,
      valuesComment: sanitizeText(body.valuesComment),
      candidStars,
      candidComment: sanitizeText(body.candidComment),
      progressStars,
      progressComment: sanitizeText(body.progressComment),
      altruismStars,
      altruismComment: sanitizeText(body.altruismComment),
      rootStars,
      rootComment: sanitizeText(body.rootComment),
    };

    const eval_ = await prisma.supervisorEval.upsert({
      where: {
        cycleId_employeeId: { cycleId: cycle.id, employeeId: body.employeeId },
      },
      update: {
        performanceStars,
        performanceComment: sanitizeText(body.performanceComment),
        ...abilityData,
        ...valuesData,
        weightedScore,
        status: isSubmit ? "SUBMITTED" : "DRAFT",
        submittedAt: isSubmit ? new Date() : undefined,
      },
      create: {
        cycleId: cycle.id,
        evaluatorId: user.id,
        employeeId: body.employeeId,
        performanceStars,
        performanceComment: sanitizeText(body.performanceComment),
        ...abilityData,
        ...valuesData,
        weightedScore,
        status: isSubmit ? "SUBMITTED" : "DRAFT",
        submittedAt: isSubmit ? new Date() : null,
      },
    });

    return NextResponse.json(eval_);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
