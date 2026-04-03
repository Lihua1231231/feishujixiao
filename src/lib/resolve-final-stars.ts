/**
 * Shared logic for resolving an employee's final calibration stars.
 * Must match archive-tables.tsx resolveEmployeeFinalStars() exactly.
 *
 * Priority: 承霖's opinion > consensus officialStars > referenceStars
 */

type OpinionInput = {
  reviewerName: string;
  decision: string;
  suggestedStars: number | null;
};

export function resolveFinalStars(
  opinions: OpinionInput[],
  referenceStars: number | null,
  consensusOfficialStars: number | null,
): number | null {
  const chenglin = opinions.find((o) => o.reviewerName.includes("承霖")) || null;
  if (chenglin && chenglin.decision !== "PENDING") {
    if (chenglin.decision === "AGREE") {
      return chenglin.suggestedStars ?? referenceStars;
    }
    return chenglin.suggestedStars;
  }
  return consensusOfficialStars ?? referenceStars;
}