import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCycle, getSessionUser } from "@/lib/session";
import {
  buildEmployeeConsensusReason,
  getFinalReviewConfigValue,
  isOrdinaryEmployeeFinalReviewSubject,
  resolveEmployeeConsensus,
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

    const [configRecord, allUsers] = await Promise.all([
      prisma.finalReviewConfig.findUnique({ where: { cycleId: cycle.id } }),
      prisma.user.findMany({
        select: { id: true, name: true, department: true, role: true },
      }),
    ]);
    const config = getFinalReviewConfigValue(cycle.id, configRecord, allUsers);
    const canReview = config.finalizerUserIds.includes(user.id);
    if (!canReview) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isOrdinaryEmployeeFinalReviewSubject(config, body.employeeId)) {
      return NextResponse.json({ error: "该员工不在普通员工终评名单中" }, { status: 400 });
    }

    const decision = typeof body.decision === "string" ? body.decision : "PENDING";
    if (!["PENDING", "AGREE", "OVERRIDE"].includes(decision)) {
      return NextResponse.json({ error: "decision must be PENDING, AGREE, or OVERRIDE" }, { status: 400 });
    }

    const employee = await prisma.user.findUnique({
      where: { id: body.employeeId },
      select: { id: true },
    });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    let suggestedStars: number | null = null;
    let reason = "";

    if (decision === "AGREE") {
      suggestedStars = validateStars(body.suggestedStars ?? body.referenceStars);
      reason = sanitizeText(body.reason);
      if (suggestedStars == null) {
        return NextResponse.json({ error: "referenceStars is required when agreeing" }, { status: 400 });
      }
    }

    if (decision === "OVERRIDE") {
      suggestedStars = validateStars(body.suggestedStars);
      reason = sanitizeText(body.reason);
      if (suggestedStars == null) {
        return NextResponse.json({ error: "suggestedStars is required when overriding" }, { status: 400 });
      }
      if (!reason) {
        return NextResponse.json({ error: "更改参考星级时必须填写理由" }, { status: 400 });
      }
    }

    const [result] = await prisma.$transaction(async (tx) => {
      const savedOpinion = await tx.finalReviewOpinion.upsert({
        where: {
          cycleId_employeeId_reviewerId: {
            cycleId: cycle.id,
            employeeId: body.employeeId,
            reviewerId: user.id,
          },
        },
        update: {
          decision,
          suggestedStars,
          reason,
        },
        create: {
          cycleId: cycle.id,
          employeeId: body.employeeId,
          reviewerId: user.id,
          decision,
          suggestedStars,
          reason,
        },
      });

      const calibratorIds = [...new Set(config.finalizerUserIds)].slice(0, 2);
      const allOpinions = await tx.finalReviewOpinion.findMany({
        where: {
          cycleId: cycle.id,
          employeeId: body.employeeId,
          reviewerId: { in: calibratorIds },
        },
      });
      const consensus = resolveEmployeeConsensus(calibratorIds, allOpinions);

      if (consensus.officialStars != null) {
        const calibrators = await tx.user.findMany({
          where: { id: { in: calibratorIds } },
          select: { id: true, name: true },
        });
        const usersById = new Map(calibrators.map((item) => [item.id, item]));
        const autoReason = buildEmployeeConsensusReason(calibratorIds, allOpinions, usersById, consensus.officialStars);

        const previousConfirmation = await tx.finalReviewConfirmation.findFirst({
          where: {
            cycleId: cycle.id,
            userId: body.employeeId,
            scope: "EMPLOYEE",
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
            finalStars: consensus.officialStars,
            adjustedBy: "系统自动生成",
            adjustReason: autoReason,
          },
          create: {
            cycleId: cycle.id,
            userId: body.employeeId,
            finalStars: consensus.officialStars,
            adjustedBy: "系统自动生成",
            adjustReason: autoReason,
          },
        });

        if (!previousConfirmation || previousConfirmation.officialStars !== consensus.officialStars || previousConfirmation.reason !== autoReason) {
          await tx.finalReviewConfirmation.create({
            data: {
              cycleId: cycle.id,
              userId: body.employeeId,
              confirmerId: user.id,
              scope: "EMPLOYEE",
              officialStars: consensus.officialStars,
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

      return [savedOpinion] as const;
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
