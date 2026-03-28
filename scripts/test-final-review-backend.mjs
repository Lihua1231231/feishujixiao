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
  assert.equal(
    source.includes("const [reviewUsers, directoryUsers] = await Promise.all(["),
    true,
    "final review helper should split review subjects from the directory used for config-name resolution",
  );
  assert.equal(
    source.includes("const usersById = new Map(directoryUsers.map((item) => [item.id, item]));"),
    true,
    "final review helper should resolve configured users from directoryUsers so admin reviewers render with names",
  );
  assert.equal(
    source.includes("performanceComment: true") &&
      source.includes("abilityComment: true") &&
      source.includes("candidComment: true") &&
      source.includes("progressComment: true") &&
      source.includes("altruismComment: true") &&
      source.includes("rootComment: true"),
    true,
    "workspace payload should select the real supervisor comment fields so the evidence panel can summarize them",
  );
  assert.equal(
    source.includes("supervisorCommentSummary:"),
    true,
    "workspace payload should include a concise supervisor comment summary for each employee",
  );
  assert.equal(
    source.includes("if (officialStars != null && referenceStars != null && officialStars !== referenceStars)"),
    true,
    "final review helper should flag official overrides from the resolved official stars, including calibration fallback results",
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
    adminConfigRoute.includes('where: { role: { not: "ADMIN" } }'),
    false,
    "admin config route should include admins when resolving final review configuration users",
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

test("final review config includes a dedicated ordinary employee roster field", () => {
  const schema = read("prisma/schema.prisma");
  const route = read("src/app/api/admin/final-review-config/route.ts");

  assert.equal(
    schema.includes("employeeSubjectUserIds"),
    true,
    "final review config needs a dedicated ordinary employee roster field",
  );
  assert.equal(
    route.includes("employeeSubjectUserIds"),
    true,
    "admin final review config API should read and write the employee roster field",
  );
});

test("workspace builder filters ordinary employees to the configured employee roster and emits visibility flags", () => {
  const source = read("src/lib/final-review.ts");
  const types = read("src/components/final-review/types.ts");
  const workspaceView = read("src/components/final-review/workspace-view.ts");

  assert.equal(
    source.includes("employeeSubjectUserIds"),
    true,
    "workspace builder should filter ordinary employees by the configured employee roster",
  );
  assert.equal(
    source.includes("canViewOpinionDetails") && source.includes("canViewLeaderEvaluationDetails"),
    true,
    "workspace rows should include explicit visibility flags instead of forcing the UI to guess",
  );
  assert.equal(
    source.includes("resolveDefaultEmployeeSubjectIds"),
    true,
    "workspace builder should fall back to the default roster when the stored employee roster is empty",
  );
  assert.equal(
    types.includes("summaryStats") && types.includes("opinionSummary"),
    true,
    "shared employee row types should include summary-first fields for later UI work",
  );
  assert.equal(
    types.includes("canViewOpinionDetails") && types.includes("canViewLeaderEvaluationDetails"),
    true,
    "shared workspace row types should carry the explicit visibility flags",
  );
  assert.equal(
    workspaceView.includes("summaryStats.overrideCount"),
    true,
    "workspace helpers should use summary-first employee stats when building priority queues",
  );
  assert.equal(
    types.includes("submissionSummary"),
    true,
    "leader row types should expose aggregate dual-review progress so ordinary viewers can stay on summary-only data",
  );
  assert.equal(
    source.includes("evaluations: canViewLeaderEvaluationDetails ? evaluations.map") &&
      source.includes(": [],"),
    true,
    "workspace builder should strip per-evaluator leader details from unauthorized payloads instead of leaking named review data",
  );
  assert.equal(
    source.includes("leaderEvaluators: canViewLeaderEvaluationDetails ? configUsers.leaderEvaluators : []"),
    true,
    "workspace config should redact named leader evaluator identities for viewers who only get summary access",
  );
  assert.equal(
    source.includes("evaluatorName: canViewLeaderEvaluationDetails ? usersById.get(evaluatorId)?.name || evaluatorId : `第${index + 1}位填写人`"),
    true,
    "leader progress summaries should stop sending configured reviewer names to unauthorized viewers",
  );
});

test("final review default roster helper lists the exact 54 names and maps them to ids", () => {
  const source = read("src/lib/final-review-defaults.ts");

  assert.equal(
    source.includes("DEFAULT_EMPLOYEE_FINAL_REVIEW_NAMES"),
    true,
    "default roster helper should export the fixed 54-person name list",
  );
  assert.equal(
    source.includes("resolveDefaultEmployeeSubjectIds"),
    true,
    "default roster helper should map roster names to user ids",
  );
});

test("admin final review config seeds empty employee rosters from the default name list", () => {
  const source = read("src/app/api/admin/final-review-config/route.ts");

  assert.equal(
    source.includes("resolveDefaultEmployeeSubjectIds"),
    true,
    "admin final review config should seed empty employee rosters from the fixed default list",
  );
  assert.equal(
    source.includes("employeeSubjectUserIds"),
    true,
    "admin final review config should persist the employee roster field",
  );
  assert.equal(
    source.includes("getFinalReviewConfigValue(cycleId, record, users)"),
    true,
    "admin final review config should keep passing directory users through so fallback leader subjects still resolve",
  );
});

test("final review write routes enforce configured subject scopes and leader dual-review readiness", () => {
  const opinionRoute = read("src/app/api/final-review/opinion/route.ts");
  const confirmRoute = read("src/app/api/final-review/confirm/route.ts");
  const leaderConfirmRoute = read("src/app/api/final-review/leader/confirm/route.ts");
  const helper = read("src/lib/final-review.ts");

  assert.equal(
    helper.includes("export function isOrdinaryEmployeeFinalReviewSubject"),
    true,
    "final review helper should centralize the configured ordinary employee subject check",
  );
  assert.equal(
    opinionRoute.includes("isOrdinaryEmployeeFinalReviewSubject"),
    true,
    "employee opinion writes should reject targets outside the configured ordinary employee roster",
  );
  assert.equal(
    confirmRoute.includes("isOrdinaryEmployeeFinalReviewSubject"),
    true,
    "employee final-confirm writes should reject targets outside the configured ordinary employee roster",
  );
  assert.equal(
    helper.includes("export function isLeaderFinalReviewReady"),
    true,
    "final review helper should centralize leader dual-review readiness checks",
  );
  assert.equal(
    leaderConfirmRoute.includes("isLeaderFinalReviewReady"),
    true,
    "leader final-confirm route should require a valid configured evaluator roster before confirming",
  );
  assert.equal(
    leaderConfirmRoute.includes("isLeaderFinalReviewReady"),
    true,
    "leader final-confirm route should keep delegating readiness to the shared helper",
  );
  assert.equal(
    helper.includes("config.leaderEvaluatorUserIds.length !== 2") &&
      helper.includes("configuredEvaluatorIds.length !== 2"),
    true,
    "leader dual-review readiness should fail closed for both over-configured rosters and duplicate evaluator ids",
  );
});
