import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as ts from "typescript";

const rootDir = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function parseTs(relativePath) {
  const source = read(relativePath);
  return {
    source,
    file: ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
  };
}

function hasModifier(node, kind) {
  return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function getExportedFunction(file, name) {
  for (const statement of file.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === name &&
      hasModifier(statement, ts.SyntaxKind.ExportKeyword)
    ) {
      return statement;
    }
  }
  return null;
}

function getCalleeName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return null;
}

function functionCallsExactName(functionLike, calleeName) {
  let found = false;
  walkFunctionBody(functionLike, (node) => {
    if (found) return;
    if (ts.isCallExpression(node)) {
      const currentName = getCalleeName(node.expression);
      if (currentName === calleeName) {
        found = true;
      }
    }
  });
  return found;
}

function walkFunctionBody(functionLike, visitor) {
  const body = functionLike.body;
  if (!body || !ts.isBlock(body)) return;

  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      return;
    }
    visitor(node);
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(body, visit);
}

function collectReturnedIdentifierNames(functionLike) {
  const names = new Set();

  const visitValue = (node) => {
    const current = ts.isParenthesizedExpression(node) ? node.expression : node;
    if (!current) return;
    if (ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current) || ts.isArrowFunction(current)) {
      return;
    }
    if (ts.isIdentifier(current)) {
      names.add(current.text);
      return;
    }
    if (ts.isObjectLiteralExpression(current)) {
      for (const property of current.properties) {
        if (ts.isShorthandPropertyAssignment(property)) {
          names.add(property.name.text);
        } else if (ts.isPropertyAssignment(property)) {
          visitValue(property.initializer);
        } else if (ts.isSpreadAssignment(property)) {
          visitValue(property.expression);
        }
      }
      return;
    }
    if (ts.isArrayLiteralExpression(current)) {
      for (const element of current.elements) visitValue(element);
      return;
    }
    if (ts.isCallExpression(current)) {
      for (const argument of current.arguments) visitValue(argument);
      return;
    }
    if (ts.isPropertyAccessExpression(current)) {
      visitValue(current.expression);
      return;
    }
    if (ts.isElementAccessExpression(current)) {
      visitValue(current.expression);
      visitValue(current.argumentExpression);
      return;
    }
    ts.forEachChild(current, visitValue);
  };

  walkFunctionBody(functionLike, (node) => {
    if (ts.isReturnStatement(node) && node.expression) {
      visitValue(node.expression);
    }
  });
  return names;
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
    source.includes("const directoryUsers = await prisma.user.findMany({"),
    true,
    "final review helper should resolve the workspace from the full directory user set",
  );
  assert.equal(
    source.includes("const config = getFinalReviewConfigValue(cycle.id, configRecord, directoryUsers);"),
    true,
    "workspace config should be resolved from the full directory so fixed company calibrators like 吴承霖、邱翔 are not lost when they are admins",
  );
  assert.equal(
    source.includes("const usersById = new Map(directoryUsers.map((item) => [item.id, item]));"),
    true,
    "final review helper should resolve configured users from directoryUsers so admin reviewers render with names",
  );
  assert.equal(
    source.includes("const subjectUsers = directoryUsers.filter(") &&
      source.includes("employeeSubjectIds.has(item.id) || leaderSubjectIds.has(item.id)"),
    true,
    "workspace subjects should be resolved from the configured rosters without pre-filtering admins",
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
    source.includes("initialReviewDetails: currentEvals.map((item) => ({"),
    true,
    "workspace payload should expose direct initial-review detail blocks for each current evaluator",
  );
  assert.equal(
    source.includes("if (officialStars != null && displayReferenceStars != null && officialStars !== displayReferenceStars)"),
    true,
    "final review helper should flag official overrides from the resolved official stars, including calibration fallback results",
  );
});

test("final review helper keeps full supervisor summaries and normalizes self-eval status labels", () => {
  const source = read("src/lib/final-review.ts");
  const supervisorRoute = read("src/app/api/supervisor-eval/route.ts");
  const detailPanel = read("src/components/final-review/employee-detail-panel.tsx");
  const types = read("src/components/final-review/types.ts");

  assert.equal(
    source.includes("function formatSelfEvalStatus("),
    true,
    "final review helper should normalize self-eval rows into readable status labels",
  );
  assert.equal(
    source.includes('if (selfEval.status === "SUBMITTED") return "已提交";') &&
      source.includes('if (selfEval.importedAt || selfEval.status === "IMPORTED") return "已导入";') &&
      source.includes('if (selfEval.status === "DRAFT") return "草稿";'),
    true,
    "self-eval status labels should distinguish submitted, imported, and draft states instead of falling through to a generic missing label",
  );
  assert.equal(
    source.includes("selfEvalStatus: formatSelfEvalStatus(selfEvalMap.get(employee.id) ?? null)"),
    true,
    "employee payload should use the normalized self-eval status helper",
  );
  assert.equal(
    source.includes("selfEvalSourceUrl: selfEvalMap.get(employee.id)?.sourceUrl || null"),
    true,
    "employee payload should expose the self-evaluation source URL when it exists",
  );
  assert.equal(
    source.includes("computePeerReviewAverageFromReviews(reviews)"),
    true,
    "final review should compute 360 averages from the unified peer-review summary helper instead of the legacy three fields",
  );
  assert.equal(
    source.includes("const pendingInitialReviewNames = initialReviewSubjectUsers") &&
      source.includes("pendingInitialReviewNames,"),
    true,
    "workspace overview should expose the missing initial-review names across employee and leader subjects",
  );
  assert.equal(
    source.includes("peerReviewSummaryByEmployee") &&
      source.includes("buildPeerReviewCategorySummary(reviews)") &&
      source.includes("getPeerReviewPerformanceAverage(review)") &&
      source.includes("getPeerReviewAbilityAverage(review)") &&
      source.includes("getPeerReviewValuesAverage(review)"),
    true,
    "final review payload should carry expandable 360 detail data built from the current review fields",
  );
  assert.equal(
    supervisorRoute.includes("buildPeerReviewCategorySummary(reviews)") &&
      supervisorRoute.includes("getPeerReviewPerformanceAverage(review)") &&
      supervisorRoute.includes("getPeerReviewAbilityAverage(review)") &&
      supervisorRoute.includes("getPeerReviewValuesAverage(review)"),
    true,
    "supervisor evaluation should also read the new peer-review dimensions through the shared summary helper",
  );
  assert.equal(
    types.includes("selfEvalSourceUrl: string | null;"),
    true,
    "employee row types should carry the self-evaluation source URL for the evidence panel",
  );
  assert.equal(
    detailPanel.includes("直属上级绩效初评明细") &&
      detailPanel.includes("DimensionDetailCard") &&
      detailPanel.includes("当前还没有可供查看的直属上级绩效初评明细。"),
    true,
    "employee evidence panel should show direct initial-review detail cards instead of the old truncated summary block",
  );
});

test("final review helper lets designated reviewers inspect calibration details without granting write access", () => {
  const source = read("src/lib/final-review.ts");

  assert.equal(
    source.includes('const OPINION_LAYOUT_VIEWER_NAMES = new Set(["向金涛", "禹聪琪"]);'),
    true,
    "final review helper should whitelist 向金涛 and 禹聪琪 for the read-only calibration inspection layout",
  );
  assert.equal(
    source.includes('const canViewOpinionDetails = user.role === "ADMIN" || isCompanyCalibrator || OPINION_LAYOUT_VIEWER_NAMES.has(user.name);'),
    true,
    "final review helper should expose opinion-detail layout access to the designated inspectors without broadening write access",
  );
});

test("final review workspace exposes same-person prior reviews as local prefills without overwriting saved opinions", () => {
  const source = read("src/lib/final-review.ts");
  const types = read("src/components/final-review/types.ts");

  assert.equal(
    source.includes("reviewerId: true"),
    true,
    "peer-review workspace query should include reviewer ids so same-person prior 360 reviews can prefill calibration drafts",
  );
  assert.equal(
    source.includes("function buildOpinionPrefillFromSupervisorEval(") &&
      source.includes("function buildOpinionPrefillFromPeerReview(") &&
      source.includes("function resolveEmployeeOpinionPrefill("),
    true,
    "final review helper should derive opinion prefills from prior supervisor or peer reviews",
  );
  assert.equal(
    source.includes("reviewerId === user.id") &&
      source.includes("(!savedOpinion || savedOpinion.decision === \"PENDING\")"),
    true,
    "prefills should only be generated for the current reviewer when no completed final-review opinion exists yet",
  );
  assert.equal(
    types.includes("hasSavedOpinion: boolean;") &&
      types.includes("prefillDecision: \"AGREE\" | \"OVERRIDE\" | null;") &&
      types.includes("prefillSuggestedStars: number | null;") &&
      types.includes("prefillReason: string;") &&
      types.includes("prefillSourceLabel: string | null;"),
    true,
    "employee opinion rows should carry explicit prefill metadata so the UI can initialize a local draft without persisting it",
  );
});

test("leader final review workspace also exposes same-person prior reviews as local prefills", () => {
  const source = read("src/lib/final-review.ts");
  const page = read("src/app/(main)/calibration/page.tsx");
  const types = read("src/components/final-review/types.ts");
  const detail = read("src/components/final-review/leader-detail-panel.tsx");

  assert.equal(
    source.includes("function buildLeaderReviewPrefillFromSupervisorEval(") &&
      source.includes("function buildLeaderReviewPrefillFromPeerReview(") &&
      source.includes("function resolveLeaderEvaluationPrefill("),
    true,
    "leader final review should derive local draft prefills from prior supervisor or peer reviews",
  );
  assert.equal(
    types.includes("hasSavedEvaluation: boolean;") &&
      types.includes("prefillForm: LeaderForm | null;") &&
      types.includes("prefillSourceLabel: string | null;"),
    true,
    "leader evaluations should carry explicit prefill metadata so the UI can initialize a local draft without persisting it",
  );
  assert.equal(
    page.includes("buildDefaultLeaderForm") &&
      page.includes("evaluation.prefillForm"),
    true,
    "leader page should initialize unsaved local forms from the prefill draft when no saved evaluation exists yet",
  );
  assert.equal(
    detail.includes("已根据你之前的") &&
      detail.includes("预填草稿") &&
      detail.includes("确认保存后才会成为主管层终评"),
    true,
    "leader questionnaire should explicitly warn that the imported same-person content is only a local draft until saved",
  );
  assert.equal(
    source.includes("function isMeaningfulLeaderReview(") &&
      source.includes("const canUsePrefill = !existing || !isMeaningfulLeaderReview(existing);") &&
      source.includes("const prefill = canUsePrefill"),
    true,
    "leader final review should still apply prefills when the only existing row is an untouched draft",
  );
  assert.equal(
    page.includes("if (evaluation.prefillForm) return evaluation.prefillForm;") &&
      !page.includes("if (evaluation.hasSavedEvaluation) return evaluation.form;"),
    true,
    "leader form initialization should prefer the prefill draft before falling back to an empty saved draft row",
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
    opinionRoute.includes("const [configRecord, allUsers] = await Promise.all([") &&
      opinionRoute.includes("prisma.user.findMany({") &&
      opinionRoute.includes("const config = getFinalReviewConfigValue(cycle.id, configRecord, allUsers);"),
    true,
    "opinion route should resolve fixed company calibrators from the full user directory instead of stale stored ids",
  );
  assert.equal(
    confirmRoute.includes("自动生成"),
    true,
    "employee confirmation route should explain that ordinary employee official results are auto-generated now",
  );
  assert.equal(
    leaderRoute.includes("weightedScore"),
    true,
    "leader route should persist the questionnaire weighted score",
  );
  assert.equal(
    leaderRoute.includes("const [configRecord, allUsers] = await Promise.all([") &&
      leaderRoute.includes("prisma.user.findMany({") &&
      leaderRoute.includes("const config = getFinalReviewConfigValue(cycle.id, configRecord, allUsers);"),
    true,
    "leader route should also resolve the fixed dual reviewers from the full directory so permissions stay on 吴承霖、邱翔",
  );
  assert.equal(
    leaderConfirmRoute.includes("自动生成"),
    true,
    "leader confirmation route should explain that leader official results are auto-generated now",
  );
});

test("calibration payload can read the active normalized layer when present", () => {
  const { file } = parseTs("src/lib/final-review.ts");
  const workspacePayload = getExportedFunction(file, "buildFinalReviewWorkspacePayload");
  const returnIdentifiers = workspacePayload ? collectReturnedIdentifierNames(workspacePayload) : new Set();

  assert.equal(
    workspacePayload != null &&
      functionCallsExactName(workspacePayload, "getAppliedNormalizationMap") &&
      returnIdentifiers.has("appliedNormalizationMap"),
    true,
    "final review payload should thread getAppliedNormalizationMap into the returned workspace payload",
  );
});

test("final review payload prefers normalized supervisor results for employee calibration displays", () => {
  const source = read("src/lib/final-review.ts");

  assert.equal(
    source.includes("normalizedSupervisor = appliedNormalizationMap.SUPERVISOR_EVAL.get(employee.id)") &&
      source.includes("displayWeightedScore = normalizedSupervisor?.normalizedScore ?? weightedScore") &&
      source.includes("displayReferenceStars = normalizedSupervisor?.normalizedStars ?? referenceStars") &&
      source.includes("const scoreSpread = normalizedSupervisor") &&
      source.includes("weightedScore: displayWeightedScore") &&
      source.includes("referenceStars: displayReferenceStars") &&
      source.includes("distributionStars: currentStars") &&
      source.includes("savedOpinion?.suggestedStars ?? displayReferenceStars") &&
      source.includes("officialStars !== displayReferenceStars"),
    true,
    "employee calibration rows should prefer the active normalized supervisor results for reference displays while keeping official results authoritative",
  );
});

test("admin verify export includes raw-vs-normalized comparison columns", () => {
  const exportRoute = read("src/app/api/admin/verify/export/route.ts");
  const verifyLib = read("src/lib/admin-verify.ts");

  assert.equal(
    exportRoute.includes("360原始均分") &&
      exportRoute.includes("360标准化分") &&
      exportRoute.includes("初评原始加权分") &&
      exportRoute.includes("初评标准化分") &&
      exportRoute.includes("初评原始等级") &&
      exportRoute.includes("初评标准化等级"),
    true,
    "admin export should surface raw-vs-normalized score columns once standardization can be applied",
  );
  assert.equal(
    verifyLib.includes("rawPeerReviewScore") &&
      verifyLib.includes("normalizedPeerReviewScore") &&
      verifyLib.includes("rawSupervisorScore") &&
      verifyLib.includes("normalizedSupervisorScore"),
    true,
    "admin verify data should carry raw-vs-normalized score fields for exports and downstream reporting",
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
    workspaceView.includes("summaryStats.disagreementCount"),
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
  assert.equal(
    source.includes('where: { role: { not: "ADMIN" } }'),
    false,
    "workspace builder should not drop configured subjects just because their directory role is ADMIN",
  );
  assert.equal(
    source.includes("const subjectUsers = directoryUsers.filter") &&
      source.includes("employeeSubjectIds.has(item.id) || leaderSubjectIds.has(item.id)"),
    true,
    "workspace builder should derive employee and leader review rows from the configured subject ids",
  );
  assert.equal(
    types.includes("pendingInitialReviewNames: string[];"),
    true,
    "employee overview should carry the concrete names still missing initial reviews",
  );
  assert.equal(
    source.includes("pendingInitialReviewNames") &&
      source.includes("[...employeeUsers, ...leaderUsers]"),
    true,
    "initial-review completion should be calculated across both employee and leader subjects so leader gaps still surface",
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
  const leaderRoute = read("src/app/api/final-review/leader/route.ts");
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
    opinionRoute.includes("config.finalizerUserIds.includes(user.id)") &&
      !opinionRoute.includes("config.accessUserIds.includes(user.id)"),
    true,
    "ordinary employee calibration writes should stay limited to the two configured company calibrators instead of every workspace viewer",
  );
  assert.equal(
    opinionRoute.includes("tx.calibrationResult.upsert"),
    true,
    "ordinary employee writes should auto-sync the official calibration result instead of waiting for a separate final-confirm endpoint",
  );
  assert.equal(
    opinionRoute.includes("resolveEmployeeConsensus") &&
      opinionRoute.includes("consensus.officialStars != null"),
    true,
    "ordinary employee official results should only be generated when both company calibrators have matching non-pending conclusions",
  );
  assert.equal(
    helper.includes("export function isLeaderFinalReviewReady"),
    true,
    "final review helper should centralize leader dual-review readiness checks",
  );
  assert.equal(
    leaderRoute.includes("resolveLeaderFinalDecision"),
    true,
    "leader questionnaire writes should reuse the shared dual-review decision helper before generating official leader results",
  );
  assert.equal(
    helper.includes("mapScoreToReferenceStars") &&
      leaderRoute.includes("finalDecision.officialStars"),
    true,
    "leader questionnaire writes should map the combined weighted score into the shared star ranges",
  );
  assert.equal(
    leaderRoute.includes("tx.calibrationResult.upsert") &&
      leaderRoute.includes("finalDecision.combinedWeightedScore"),
    true,
    "leader official results should be auto-generated from the two submitted questionnaires instead of relying on a third-person final confirmation route",
  );
  assert.equal(
    leaderRoute.includes("config.leaderEvaluatorUserIds.includes(user.id)") &&
      !leaderRoute.includes('user.role === "ADMIN" || config.leaderEvaluatorUserIds.includes(user.id)'),
    true,
    "leader questionnaire writes should stay limited to the configured dual-review evaluators, leaving non-evaluator admins in view-only mode",
  );
  assert.equal(
    helper.includes("config.leaderEvaluatorUserIds.length !== 2") &&
      helper.includes("configuredEvaluatorIds.length !== 2"),
    true,
    "leader dual-review readiness should fail closed for both over-configured rosters and duplicate evaluator ids",
  );
  assert.equal(
    confirmRoute.includes("自动生成") && leaderConfirmRoute.includes("自动生成"),
    true,
    "legacy confirmation endpoints should be explicitly deprecated once auto-generation owns the official result flow",
  );
});
