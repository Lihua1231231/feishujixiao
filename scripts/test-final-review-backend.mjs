import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("prisma schema defines final review configuration and audit models", () => {
  const source = read("prisma/schema.prisma");

  assert.equal(
    source.includes("model FinalReviewConfig {"),
    true,
    "schema should persist per-cycle final review configuration",
  );
  assert.equal(
    source.includes("model FinalReviewOpinion {"),
    true,
    "schema should persist reviewer-by-reviewer employee final review opinions",
  );
  assert.equal(
    source.includes("model LeaderFinalReview {"),
    true,
    "schema should persist the dedicated leader dual-review questionnaire",
  );
  assert.equal(
    source.includes("model FinalReviewConfirmation {"),
    true,
    "schema should persist final confirmation history for employee and leader subjects",
  );
});

test("final review helper centralizes config parsing, access checks, and reference star mapping", () => {
  const source = read("src/lib/final-review.ts");

  assert.equal(
    source.includes("export const DEFAULT_REFERENCE_STAR_RANGES"),
    true,
    "final review helper should define default score-to-star ranges",
  );
  assert.equal(
    source.includes("export function mapScoreToReferenceStars"),
    true,
    "final review helper should map weighted scores into configurable reference stars",
  );
  assert.equal(
    source.includes("export async function canAccessFinalReviewWorkspace"),
    true,
    "final review helper should expose the workspace access guard",
  );
});

test("final review routes expose config, workspace, opinion, leader review, and confirmation entrypoints", () => {
  const adminConfigRoute = read("src/app/api/admin/final-review-config/route.ts");
  const workspaceRoute = read("src/app/api/final-review/workspace/route.ts");
  const opinionRoute = read("src/app/api/final-review/opinion/route.ts");
  const confirmRoute = read("src/app/api/final-review/confirm/route.ts");
  const leaderRoute = read("src/app/api/final-review/leader/route.ts");
  const leaderConfirmRoute = read("src/app/api/final-review/leader/confirm/route.ts");

  assert.equal(
    adminConfigRoute.includes("referenceStarRanges"),
    true,
    "admin config route should accept and return reference star ranges",
  );
  assert.equal(
    workspaceRoute.includes("buildFinalReviewWorkspacePayload"),
    true,
    "workspace route should delegate the large aggregation to a helper",
  );
  assert.equal(
    opinionRoute.includes("\"AGREE\"") && opinionRoute.includes("\"OVERRIDE\""),
    true,
    "opinion route should support agree and override employee-review decisions",
  );
  assert.equal(
    confirmRoute.includes("officialStars") && confirmRoute.includes("reason"),
    true,
    "employee confirmation route should accept official stars and confirmation reason",
  );
  assert.equal(
    leaderRoute.includes("weightedScore"),
    true,
    "leader route should persist the questionnaire weighted score",
  );
  assert.equal(
    leaderConfirmRoute.includes("officialStars") && leaderConfirmRoute.includes("reason"),
    true,
    "leader confirmation route should finalize the official leader stars with a reason",
  );
});
