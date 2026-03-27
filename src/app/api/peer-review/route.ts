import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { sanitizeText, validateStars } from "@/lib/validate";

function normalizeUnknownComment(score: number | null, comment: unknown) {
  const sanitized = sanitizeText(comment);
  if (score === 0) return sanitized || "不了解";
  return sanitized;
}

// Get peer reviews assigned to current user
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const cycle = await prisma.reviewCycle.findFirst({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
    });
    if (!cycle) return NextResponse.json([]);

    const reviews = await prisma.peerReview.findMany({
      where: { cycleId: cycle.id, reviewerId: user.id },
      include: { reviewee: { select: { id: true, name: true, department: true } } },
    });

    // Attach self-eval sourceUrl for each reviewee
    const revieweeIds = [...new Set(reviews.map(r => r.revieweeId))];
    const selfEvals = await prisma.selfEvaluation.findMany({
      where: { cycleId: cycle.id, userId: { in: revieweeIds } },
      select: { userId: true, sourceUrl: true },
    });
    const selfEvalMap = new Map(selfEvals.map(s => [s.userId, s.sourceUrl]));

    return NextResponse.json(reviews.map(r => ({
      ...r,
      revieweeSelfEvalUrl: selfEvalMap.get(r.revieweeId) || null,
    })));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// Submit a peer review
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const isSubmit = body.action === "submit";

    // TOCTOU fix: check ownership and status before updating
    const existing = await prisma.peerReview.findUnique({ where: { id: body.id } });
    if (!existing || existing.reviewerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (existing.status === "SUBMITTED") {
      return NextResponse.json({ error: "已提交，无法修改" }, { status: 400 });
    }
    if (existing.status === "DECLINED") {
      return NextResponse.json({ error: "已拒评，无法修改" }, { status: 400 });
    }

    // 新维度（与绩效初评一致）
    const performanceStars = validateStars(body.performanceStars);
    const comprehensiveStars = validateStars(body.comprehensiveStars);
    const learningStars = validateStars(body.learningStars);
    const adaptabilityStars = validateStars(body.adaptabilityStars);
    const candidStars = validateStars(body.candidStars);
    const progressStars = validateStars(body.progressStars);
    const altruismStars = validateStars(body.altruismStars);
    const rootStars = validateStars(body.rootStars);
    const performanceComment = normalizeUnknownComment(performanceStars, body.performanceComment);
    const comprehensiveComment = normalizeUnknownComment(comprehensiveStars, body.comprehensiveComment);
    const learningComment = normalizeUnknownComment(learningStars, body.learningComment);
    const adaptabilityComment = normalizeUnknownComment(adaptabilityStars, body.adaptabilityComment);
    const candidComment = normalizeUnknownComment(candidStars, body.candidComment);
    const progressComment = normalizeUnknownComment(progressStars, body.progressComment);
    const altruismComment = normalizeUnknownComment(altruismStars, body.altruismComment);
    const rootComment = normalizeUnknownComment(rootStars, body.rootComment);

    if (isSubmit) {
      if (performanceStars === null || comprehensiveStars === null || learningStars === null || adaptabilityStars === null || candidStars === null || progressStars === null || altruismStars === null || rootStars === null) {
        return NextResponse.json({ error: "请完成所有维度的星级评分（可选「不了解」）" }, { status: 400 });
      }
      // 选了"不了解"(0)的维度不要求评语
      const missingComments: string[] = [];
      if (performanceStars! > 0 && !performanceComment) missingComments.push("业绩产出");
      if (comprehensiveStars! > 0 && !comprehensiveComment) missingComments.push("综合能力");
      if (learningStars! > 0 && !learningComment) missingComments.push("学习能力");
      if (adaptabilityStars! > 0 && !adaptabilityComment) missingComments.push("适应能力");
      if (candidStars! > 0 && !candidComment) missingComments.push("坦诚真实");
      if (progressStars! > 0 && !progressComment) missingComments.push("极致进取");
      if (altruismStars! > 0 && !altruismComment) missingComments.push("成就利他");
      if (rootStars! > 0 && !rootComment) missingComments.push("ROOT");
      if (missingComments.length > 0) {
        return NextResponse.json({ error: `请填写以下维度的文字评语：${missingComments.join("、")}` }, { status: 400 });
      }
    }

    const review = await prisma.peerReview.update({
      where: { id: body.id },
      data: {
        performanceStars,
        performanceComment,
        comprehensiveStars,
        comprehensiveComment,
        learningStars,
        learningComment,
        adaptabilityStars,
        adaptabilityComment,
        abilityComment: sanitizeText(body.abilityComment),
        candidStars,
        candidComment,
        progressStars,
        progressComment,
        altruismStars,
        altruismComment,
        rootStars,
        rootComment,
        status: isSubmit ? "SUBMITTED" : "DRAFT",
        submittedAt: isSubmit ? new Date() : undefined,
      },
    });

    return NextResponse.json(review);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
