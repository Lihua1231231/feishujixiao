import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCycle, getSessionUser } from "@/lib/session";
import {
  computeSupervisorWeightedScore,
  getFinalReviewConfigValue,
  resolveLeaderFinalDecision,
} from "@/lib/final-review";
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
    if (!body?.employeeId || typeof body.employeeId !== "string") {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    }

    const configRecord = await prisma.finalReviewConfig.findUnique({ where: { cycleId: cycle.id } });
    const config = getFinalReviewConfigValue(cycle.id, configRecord);
    const canEdit = config.leaderEvaluatorUserIds.includes(user.id);
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!config.leaderSubjectUserIds.includes(body.employeeId)) {
      return NextResponse.json({ error: "该员工不在主管层终评名单中" }, { status: 400 });
    }

    const isSubmit = body.action === "submit";
    const performanceStars = validateStars(body.performanceStars);
    const comprehensiveStars = validateStars(body.comprehensiveStars);
    const learningStars = validateStars(body.learningStars);
    const adaptabilityStars = validateStars(body.adaptabilityStars);
    const candidStars = validateStars(body.candidStars);
    const progressStars = validateStars(body.progressStars);
    const altruismStars = validateStars(body.altruismStars);
    const rootStars = validateStars(body.rootStars);
    const abilityStars = (comprehensiveStars != null && learningStars != null && adaptabilityStars != null)
      ? Math.round((comprehensiveStars + learningStars + adaptabilityStars) / 3)
      : null;
    const valuesStars = (candidStars != null && progressStars != null && altruismStars != null && rootStars != null)
      ? Math.round((candidStars + progressStars + altruismStars + rootStars) / 4)
      : null;
    const weightedScore = computeSupervisorWeightedScore(performanceStars, abilityStars, valuesStars);

    if (isSubmit) {
      if (
        performanceStars == null ||
        comprehensiveStars == null ||
        learningStars == null ||
        adaptabilityStars == null ||
        candidStars == null ||
        progressStars == null ||
        altruismStars == null ||
        rootStars == null
      ) {
        return NextResponse.json({ error: "请完成所有维度的星级评分" }, { status: 400 });
      }
      const requiredComments = [
        sanitizeText(body.performanceComment),
        sanitizeText(body.abilityComment),
        sanitizeText(body.candidComment),
        sanitizeText(body.progressComment),
        sanitizeText(body.altruismComment),
        sanitizeText(body.rootComment),
      ];
      if (requiredComments.some((item) => !item)) {
        return NextResponse.json({ error: "请填写所有维度的文字评语" }, { status: 400 });
      }
    }

    const payload = {
      performanceStars,
      performanceComment: sanitizeText(body.performanceComment),
      abilityStars,
      abilityComment: sanitizeText(body.abilityComment),
      comprehensiveStars,
      learningStars,
      adaptabilityStars,
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
      weightedScore,
      status: isSubmit ? "SUBMITTED" : "DRAFT",
      submittedAt: isSubmit ? new Date() : null,
    };

    const [result] = await prisma.$transaction(async (tx) => {
      const savedReview = await tx.leaderFinalReview.upsert({
        where: {
          cycleId_employeeId_evaluatorId: {
            cycleId: cycle.id,
            employeeId: body.employeeId,
            evaluatorId: user.id,
          },
        },
        update: payload,
        create: {
          cycleId: cycle.id,
          employeeId: body.employeeId,
          evaluatorId: user.id,
          ...payload,
        },
      });

      const allReviews = await tx.leaderFinalReview.findMany({
        where: {
          cycleId: cycle.id,
          employeeId: body.employeeId,
          evaluatorId: { in: config.leaderEvaluatorUserIds },
        },
        select: {
          evaluatorId: true,
          weightedScore: true,
          status: true,
        },
      });
      const finalDecision = resolveLeaderFinalDecision(
        config.leaderEvaluatorUserIds,
        allReviews,
        config.referenceStarRanges,
      );

      if (finalDecision.ready && finalDecision.officialStars != null) {
        const evaluators = await tx.user.findMany({
          where: { id: { in: config.leaderEvaluatorUserIds } },
          select: { id: true, name: true },
        });
        const namesById = new Map(evaluators.map((item) => [item.id, item.name]));
        const scoreBreakdown = allReviews
          .map((review) => `${namesById.get(review.evaluatorId) || review.evaluatorId} ${review.weightedScore?.toFixed(1) ?? "—"} 分`)
          .join("；");
        const autoReason = `${scoreBreakdown}；按 50/50 加权得到 ${finalDecision.combinedWeightedScore?.toFixed(1) ?? "—"} 分，对应 ${finalDecision.officialStars} 星`;

        const previousConfirmation = await tx.finalReviewConfirmation.findFirst({
          where: {
            cycleId: cycle.id,
            userId: body.employeeId,
            scope: "LEADER",
          },
          orderBy: { createdAt: "desc" },
        });

        await tx.calibrationResult.upsert({
          where: {
            cycleId_userId: {
              cycleId: cycle.id,
              userId: body.employeeId,
            },
          },
          update: {
            finalStars: finalDecision.officialStars,
            adjustedBy: "系统自动生成",
            adjustReason: autoReason,
          },
          create: {
            cycleId: cycle.id,
            userId: body.employeeId,
            finalStars: finalDecision.officialStars,
            adjustedBy: "系统自动生成",
            adjustReason: autoReason,
          },
        });

        if (!previousConfirmation || previousConfirmation.officialStars !== finalDecision.officialStars || previousConfirmation.reason !== autoReason) {
          await tx.finalReviewConfirmation.create({
            data: {
              cycleId: cycle.id,
              userId: body.employeeId,
              confirmerId: user.id,
              scope: "LEADER",
              officialStars: finalDecision.officialStars,
              reason: autoReason,
            },
          });
        }
      } else {
        await tx.calibrationResult.upsert({
          where: {
            cycleId_userId: {
              cycleId: cycle.id,
              userId: body.employeeId,
            },
          },
          update: {
            finalStars: null,
            adjustedBy: null,
            adjustReason: null,
          },
          create: {
            cycleId: cycle.id,
            userId: body.employeeId,
            finalStars: null,
            adjustedBy: null,
            adjustReason: null,
          },
        });
      }

      return [savedReview] as const;
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
