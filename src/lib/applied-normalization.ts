import { prisma } from "@/lib/db";
import type { ScoreNormalizationSource } from "@/lib/score-normalization";

export type AppliedNormalizationValue = {
  normalizedScore: number | null;
  normalizedStars: number | null;
  snapshotId: string;
};

export async function getAppliedNormalizationMap(
  cycleId: string,
  source: ScoreNormalizationSource,
) {
  const application = await prisma.scoreNormalizationApplication.findUnique({
    where: {
      cycleId_source: {
        cycleId,
        source,
      },
    },
    select: {
      snapshotId: true,
      revertedAt: true,
    },
  });

  if (!application || application.revertedAt != null) {
    return new Map<string, AppliedNormalizationValue>();
  }

  const entries = await prisma.scoreNormalizationEntry.findMany({
    where: {
      snapshotId: application.snapshotId,
    },
    select: {
      subjectId: true,
      normalizedScore: true,
      bucketIndex: true,
    },
  });

  return new Map<string, AppliedNormalizationValue>(
    entries.map((entry) => [
      entry.subjectId,
      {
        normalizedScore: entry.normalizedScore != null ? Number(entry.normalizedScore) : null,
        normalizedStars: entry.bucketIndex ?? null,
        snapshotId: application.snapshotId,
      },
    ]),
  );
}
