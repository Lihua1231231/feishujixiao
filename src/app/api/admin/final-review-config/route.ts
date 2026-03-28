import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, getActiveCycle } from "@/lib/session";
import {
  DEFAULT_REFERENCE_STAR_RANGES,
  type FinalReviewConfigValue,
  getFinalReviewConfigValue,
  serializeReferenceStarRanges,
  type ReferenceStarRange,
} from "@/lib/final-review";
import { resolveDefaultEmployeeSubjectIds } from "@/lib/final-review-defaults";

type AdminFinalReviewConfigValue = FinalReviewConfigValue & {
  employeeSubjectUserIds: string[];
};

function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseStoredIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function buildAdminConfigValue(
  cycleId: string,
  record: {
    accessUserIds: string;
    finalizerUserIds: string;
    leaderEvaluatorUserIds: string;
    leaderSubjectUserIds: string;
    employeeSubjectUserIds: string;
    referenceStarRanges: string;
  } | null,
  users: Array<{ id: string; name: string; department: string; role: string }>,
): AdminFinalReviewConfigValue {
  const config = getFinalReviewConfigValue(cycleId, record, users);
  const employeeSubjectUserIds = parseStoredIds(record?.employeeSubjectUserIds);

  return {
    ...config,
    employeeSubjectUserIds:
      employeeSubjectUserIds.length > 0 ? employeeSubjectUserIds : resolveDefaultEmployeeSubjectIds(users),
  };
}

function normalizeRanges(value: unknown): ReferenceStarRange[] {
  if (!Array.isArray(value)) return DEFAULT_REFERENCE_STAR_RANGES;
  const ranges = value
    .map((item) => ({
      stars: Number((item as ReferenceStarRange)?.stars),
      min: Number((item as ReferenceStarRange)?.min),
      max: Number((item as ReferenceStarRange)?.max),
    }))
    .filter((item) => Number.isFinite(item.stars) && Number.isFinite(item.min) && Number.isFinite(item.max))
    .sort((a, b) => a.stars - b.stars);

  if (ranges.length !== 5) return DEFAULT_REFERENCE_STAR_RANGES;
  return ranges;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cycleId = req.nextUrl.searchParams.get("cycleId");
    const cycle = cycleId
      ? await prisma.reviewCycle.findUnique({ where: { id: cycleId } })
      : await getActiveCycle();
    if (!cycle) {
      return NextResponse.json({ error: "No active cycle" }, { status: 400 });
    }

    const [record, users] = await Promise.all([
      prisma.finalReviewConfig.findUnique({ where: { cycleId: cycle.id } }),
      prisma.user.findMany({
        select: { id: true, name: true, department: true, role: true },
        orderBy: [{ department: "asc" }, { name: "asc" }],
      }),
    ]);

    const config = buildAdminConfigValue(cycle.id, record, users);
    return NextResponse.json({
      cycle: { id: cycle.id, name: cycle.name, status: cycle.status },
      config,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    if (!body?.cycleId || typeof body.cycleId !== "string") {
      return NextResponse.json({ error: "cycleId is required" }, { status: 400 });
    }

    const ranges = normalizeRanges(body.referenceStarRanges);
    if (ranges.some((range) => range.min > range.max)) {
      return NextResponse.json({ error: "referenceStarRanges contains invalid min/max values" }, { status: 400 });
    }

    const existingConfig = await prisma.finalReviewConfig.findUnique({
      where: { cycleId: body.cycleId },
      select: { employeeSubjectUserIds: true },
    });

    const explicitEmployeeSubjectUserIds =
      Object.prototype.hasOwnProperty.call(body, "employeeSubjectUserIds") ? normalizeIds(body.employeeSubjectUserIds) : null;
    const storedEmployeeSubjectUserIds = parseStoredIds(existingConfig?.employeeSubjectUserIds);
    const users =
      explicitEmployeeSubjectUserIds != null || storedEmployeeSubjectUserIds.length > 0
        ? []
        : await prisma.user.findMany({
            select: { id: true, name: true, department: true, role: true },
            orderBy: [{ department: "asc" }, { name: "asc" }],
          });
    const employeeSubjectUserIds =
      explicitEmployeeSubjectUserIds ??
      (storedEmployeeSubjectUserIds.length > 0
        ? storedEmployeeSubjectUserIds
        : resolveDefaultEmployeeSubjectIds(users));

    const config = await prisma.finalReviewConfig.upsert({
      where: { cycleId: body.cycleId },
      update: {
        accessUserIds: JSON.stringify(normalizeIds(body.accessUserIds)),
        finalizerUserIds: JSON.stringify(normalizeIds(body.finalizerUserIds)),
        leaderEvaluatorUserIds: JSON.stringify(normalizeIds(body.leaderEvaluatorUserIds)),
        leaderSubjectUserIds: JSON.stringify(normalizeIds(body.leaderSubjectUserIds)),
        employeeSubjectUserIds: JSON.stringify(employeeSubjectUserIds),
        referenceStarRanges: serializeReferenceStarRanges(ranges),
      },
      create: {
        cycleId: body.cycleId,
        accessUserIds: JSON.stringify(normalizeIds(body.accessUserIds)),
        finalizerUserIds: JSON.stringify(normalizeIds(body.finalizerUserIds)),
        leaderEvaluatorUserIds: JSON.stringify(normalizeIds(body.leaderEvaluatorUserIds)),
        leaderSubjectUserIds: JSON.stringify(normalizeIds(body.leaderSubjectUserIds)),
        employeeSubjectUserIds: JSON.stringify(employeeSubjectUserIds),
        referenceStarRanges: serializeReferenceStarRanges(ranges),
      },
    });

    return NextResponse.json({
      ok: true,
      config: buildAdminConfigValue(body.cycleId, config, users.length > 0 ? users : []),
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
