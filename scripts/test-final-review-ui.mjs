import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function assertSourceContains(source, token, message) {
  assert.equal(
    source.includes(token),
    true,
    message,
  );
}

test("admin page adds a dedicated final review configuration tab", () => {
  const source = read("src/app/(main)/admin/page.tsx");

  assert.equal(
    source.includes("<TabsTrigger value=\"finalReview\">终评配置</TabsTrigger>"),
    true,
    "admin page should expose a final review configuration tab",
  );
  assert.equal(
    source.includes("参考星级分数区间"),
    true,
    "admin page should let admins configure score-to-reference-star ranges",
  );
  assert.equal(
    source.includes("主管层终评名单"),
    true,
    "admin page should expose the configurable leader subject roster",
  );
});

test("calibration page becomes a three-tab final review workspace", () => {
  const page = read("src/app/(main)/calibration/page.tsx");
  const principles = read("src/components/final-review/principles-tab.tsx");

  assertSourceContains(page, "原则", "calibration page should include the tab label \"原则\"");
  assertSourceContains(page, "非主管员工终评", "calibration page should include the tab label \"非主管员工终评\"");
  assertSourceContains(page, "主管层双人终评", "calibration page should include the tab label \"主管层双人终评\"");
  assert.equal(
    page.includes("参考星级由初评加权分换算"),
    true,
    "employee final review rows should explain where the reference star comes from",
  );
  assert.equal(
    page.includes("setInterval(loadWorkspace, 30000)"),
    true,
    "final review workspace should auto-refresh every 30 seconds",
  );
  assert.equal(
    principles.includes("这一页告诉你本轮终评按什么原则看人、谁参与拍板、现在卡在哪"),
    true,
    "principles tab should explain its purpose in plain operator language",
  );
  assert.equal(
    page.includes("这一页告诉你本轮终评按什么原则看人、谁参与拍板、现在卡在哪"),
    false,
    "calibration page should not keep the principles briefing copy inline",
  );
  assert.equal(
    page.includes("这一页处理普通员工终评：先看分布，再逐个员工留下意见，最后由最终确认人拍板"),
    true,
    "employee tab should explain the workflow in plain language",
  );
  assert.equal(
    page.includes("这一页只处理主管层终评：先由两位填写人分别打分，再由最终确认人统一拍板"),
    true,
    "leader tab should explain the workflow in plain language",
  );
  assert.equal(
    principles.includes("5位终评相关人已完成的意见数"),
    true,
    "top progress cards should explain what the metric actually means",
  );
  assert.equal(
    principles.includes("主管层问卷填写进度"),
    true,
    "leader submission card should use plain-language wording",
  );
});

test("principles-tab source includes redesign tokens", () => {
  const source = read("src/components/final-review/principles-tab.tsx");

  assertSourceContains(source, "原则", "principles tab should include the briefing anchor token \"原则\"");
  assertSourceContains(source, "全公司星级分布", "principles tab should include the overview token \"全公司星级分布\"");
  assertSourceContains(source, "分数带", "principles tab should include the cockpit metric token \"分数带\"");
  assertSourceContains(source, "一句话解读", "principles tab should include the summary token \"一句话解读\"");
});

test("principles tab owns chart composition while the page stays a data container", () => {
  const page = read("src/app/(main)/calibration/page.tsx");
  const principles = read("src/components/final-review/principles-tab.tsx");

  assert.equal(
    page.includes('from "@/components/final-review/principles-tab"'),
    true,
    "calibration page should import the dedicated principles tab component",
  );
  assert.equal(
    page.includes('from "@/components/final-review/score-band-chart"'),
    false,
    "calibration page should stop importing the score band chart helper directly",
  );
  assert.equal(
    page.includes('from "@/components/final-review/star-distribution-chart"'),
    false,
    "calibration page should stop importing the star distribution chart helper directly",
  );
  assert.equal(
    principles.includes('from "./score-band-chart"') && principles.includes('from "./star-distribution-chart"'),
    true,
    "principles tab should own the chart helper composition",
  );
  assert.equal(
    page.includes("全公司星级分布") || page.includes("一句话解读"),
    false,
    "calibration page should not keep principles-only chart or summary wording inline",
  );
});

test("principles-tab handles overdue wording and globals keep cockpit styling token-based", () => {
  const principles = read("src/components/final-review/principles-tab.tsx");
  const globals = read("src/app/globals.css");

  assert.equal(
    principles.includes("距离截止还有 ${formatCountdown(cycle.calibrationEnd)}"),
    false,
    "principles summary should not produce awkward overdue wording by prefixing all countdown states the same way",
  );
  assert.equal(
    principles.includes("已过校准截止时间"),
    true,
    "principles summary should include an overdue-specific phrase after the deadline passes",
  );
  assert.equal(
    globals.includes("--cockpit-surface") && globals.includes("--cockpit-border"),
    true,
    "globals should keep a minimal set of cockpit tokens",
  );
  assert.equal(
    globals.includes("--color-cockpit-"),
    false,
    "globals should not add extra app-wide cockpit color aliases",
  );
  assert.equal(
    globals.includes(".final-review-cockpit-"),
    false,
    "globals should not add component-specific cockpit utility classes",
  );
});

test("calibration page source includes employee-tab redesign tokens", () => {
  const source = read("src/app/(main)/calibration/page.tsx");

  assertSourceContains(source, "重点名单", "employee tab should include the navigation token \"重点名单\"");
  assertSourceContains(source, "待拍板", "employee tab should include the queue status token \"待拍板\"");
  assertSourceContains(source, "意见分歧大", "employee tab should include the triage token \"意见分歧大\"");
  assertSourceContains(source, "最终决策", "employee tab should include the decision panel token \"最终决策\"");
});

test("calibration page source includes leader-tab redesign tokens", () => {
  const source = read("src/app/(main)/calibration/page.tsx");

  assertSourceContains(source, "双人意见对照", "leader tab should include the comparison token \"双人意见对照\"");
  assertSourceContains(source, "双人提交进度", "leader tab should include the progress token \"双人提交进度\"");
  assertSourceContains(source, "主管名单", "leader tab should include the roster token \"主管名单\"");
});

test("calibration page delegates cockpit shaping to shared final-review helpers", () => {
  const page = read("src/app/(main)/calibration/page.tsx");

  assert.equal(
    page.includes('from "@/components/final-review/workspace-view"') &&
      page.includes('from "@/components/final-review/types"'),
    true,
    "the page should stop inlining all workspace types and derived view logic",
  );
});

test("calibration page delegates employee-tab composition to dedicated cockpit components", () => {
  const page = read("src/app/(main)/calibration/page.tsx");

  assert.equal(
    page.includes('from "@/components/final-review/employee-cockpit"') &&
      page.includes('from "@/components/final-review/employee-detail-panel"'),
    true,
    "the page should import the dedicated employee cockpit and detail panel helpers",
  );
});

test("leader tab composes a dual-review cockpit with paired comparison and detail panel", () => {
  const page = read("src/app/(main)/calibration/page.tsx");

  assert.equal(
    page.includes('from "@/components/final-review/leader-cockpit"') &&
      page.includes('from "@/components/final-review/leader-detail-panel"'),
    true,
    "leader final review UI should be split into dedicated cockpit components",
  );
});

test("leader detail panel ties questionnaire editability to each evaluation's ownership state", () => {
  const detailPanel = read("src/components/final-review/leader-detail-panel.tsx");

  assert.equal(
    detailPanel.includes("editable={evaluation.editable}"),
    true,
    "leader questionnaire editability should come directly from each evaluation's editable flag",
  );
  assert.equal(
    detailPanel.includes("disabled={!editable}"),
    true,
    "leader questionnaire inputs should become read-only when the evaluation is not editable",
  );
  assert.equal(
    detailPanel.includes('{!editable ? <Badge variant="outline">只读</Badge> : null}'),
    true,
    "leader questionnaire should visibly mark non-owned evaluations as read-only",
  );
});

test("leader detail panel keeps dual-review comparisons summary-only until the permission gate", () => {
  const detailPanel = read("src/components/final-review/leader-detail-panel.tsx");
  const comparisonStart = detailPanel.indexOf('{comparisonTitle}</p>');
  const questionnaireStart = detailPanel.indexOf('{questionnaireTitle}</p>');
  const permissionGate = detailPanel.indexOf('leader.canViewLeaderEvaluationDetails ? (', comparisonStart);
  const detailedComparison = detailPanel.indexOf('leader.evaluations.map((evaluation) => {', comparisonStart);
  const summarySlice = detailPanel.slice(comparisonStart, permissionGate === -1 ? questionnaireStart : permissionGate);

  assert.equal(
    permissionGate !== -1 && permissionGate < detailedComparison,
    true,
    "leader detail panel should gate the detailed comparison block before any evaluator names or score breakdowns appear",
  );
  assert.equal(
    summarySlice.includes("evaluation.evaluatorName"),
    false,
    "leader detail panel should keep evaluator names out of the default comparison summary",
  );
  assert.equal(
    summarySlice.includes("computeWeightedScore(form)"),
    false,
    "leader detail panel should keep the detailed score breakdown out of the default comparison summary",
  );
});

test("employee detail panel collapses opinion process rows until the permission gate", () => {
  const detailPanel = read("src/components/final-review/employee-detail-panel.tsx");
  const processStart = detailPanel.indexOf('过程留痕');
  const permissionGate = detailPanel.indexOf('employee.canViewOpinionDetails ? (', processStart);
  const opinionRows = detailPanel.indexOf('employee.opinions.map((opinion) => (', processStart);
  const summarySlice = detailPanel.slice(processStart, permissionGate === -1 ? detailPanel.length : permissionGate);

  assert.equal(
    permissionGate !== -1 && permissionGate < opinionRows,
    true,
    "employee detail panel should gate the opinion process timeline before any per-person rows appear",
  );
  assert.equal(
    summarySlice.includes("opinion.reviewerName"),
    false,
    "employee detail panel should keep reviewer names out of the default process summary",
  );
  assert.equal(
    summarySlice.includes("opinion.decisionLabel"),
    false,
    "employee detail panel should keep per-person decision labels out of the default process summary",
  );
});

test("leader polling refresh uses latest-response-wins plus server-snapshot diffing", () => {
  const page = read("src/app/(main)/calibration/page.tsx");

  assert.equal(
    page.includes("latestWorkspaceRequestIdRef"),
    true,
    "leader workspace polling should track the latest in-flight response so stale responses cannot win",
  );
  assert.equal(
    page.includes("if (requestId !== latestWorkspaceRequestIdRef.current)"),
    true,
    "older workspace responses should be ignored once a newer request has started",
  );
  assert.equal(
    page.includes("leaderServerFormsRef"),
    true,
    "leader form syncing should compare local drafts against the last server snapshot instead of a sticky touched flag",
  );
  assert.equal(
    page.includes("const previousLeaderServerForms = leaderServerFormsRef.current;"),
    true,
    "leader refresh merging should capture the previous server snapshot before queueing state updates",
  );
  assert.equal(
    page.includes("!areLeaderFormsEqual(localForm, previousServerForm)"),
    true,
    "a local leader form should only stay pinned when it truly differs from the last server snapshot",
  );
  assert.equal(
    page.includes("const previousServerForm = previousLeaderServerForms[key] ?? serverForm;"),
    true,
    "leader refresh merging should compare drafts against the captured pre-refresh snapshot, not a mutable ref",
  );
  assert.equal(
    page.includes("dirtyLeaderFormKeysRef"),
    false,
    "leader polling should stop relying on the sticky dirty-key approach",
  );
});

test("leader detail panel gates final confirmation on dual submission readiness", () => {
  const detailPanel = read("src/components/final-review/leader-detail-panel.tsx");

  assert.equal(
    detailPanel.includes('disabled={!leader.bothSubmitted || savingConfirmation}'),
    true,
    "leader confirmation action should stay disabled until both reviews are submitted",
  );
  assert.equal(
    detailPanel.includes('{!leader.bothSubmitted ? ('),
    true,
    "leader detail panel should show the waiting-state explanation when dual submission is incomplete",
  );
  assert.equal(
    detailPanel.includes('leader.bothSubmitted ? "双人已齐备" : "待双人齐备"'),
    true,
    "leader detail panel should key its submission status copy off the same dual-submission state",
  );
});

test("employee cockpit keeps a reachable all-employee roster alongside priority queues", () => {
  const cockpit = read("src/components/final-review/employee-cockpit.tsx");

  assert.equal(
    cockpit.includes("全部员工"),
    true,
    "the employee cockpit should include a dedicated all-employee roster so confirmed employees stay reachable",
  );
});

test("employee priority queues treat missing official stars as pending", () => {
  const workspaceView = read("src/components/final-review/workspace-view.ts");

  assert.equal(
    workspaceView.includes("row.officialStars == null"),
    true,
    "pending employee queues should key off missing official stars to match the official pending metric",
  );
  assert.equal(
    workspaceView.includes("!row.officialConfirmedAt"),
    false,
    "pending employee queues should not rely on missing confirmation time anymore",
  );
});

test("employee cockpit risk labels use review signals instead of generic bookkeeping tags", () => {
  const workspaceView = read("src/components/final-review/workspace-view.ts");
  const payload = read("src/lib/final-review.ts");

  assert.equal(
    payload.includes('anomalyTags.push("待官方确认")'),
    false,
    "risk labels should stop treating missing official confirmation as an anomaly signal",
  );
  assert.equal(
    payload.includes('anomalyTags.push("缺少参考星级")'),
    false,
    "risk labels should stop treating missing reference stars as a review-risk signal",
  );
  assert.equal(
    payload.includes('anomalyTags.push("存在改星意见")') && payload.includes('anomalyTags.push("初评分差较大")'),
    true,
    "payload should derive anomaly tags from actual disagreement and score-spread signals",
  );
  assert.equal(
    payload.includes("if (officialStars != null && referenceStars != null && officialStars !== referenceStars)") &&
      !payload.includes("latestConfirmation && referenceStars != null && latestConfirmation.officialStars !== referenceStars"),
    true,
    "official override signaling should compare the resolved official stars against the reference stars",
  );
  assert.equal(
    workspaceView.includes("风险信号"),
    true,
    "employee priority cards should describe these queues as risk signals rather than generic anomaly labels",
  );
});

test("employee evidence panel shows a concise supervisor comment summary", () => {
  const detailPanel = read("src/components/final-review/employee-detail-panel.tsx");
  const types = read("src/components/final-review/types.ts");
  const payload = read("src/lib/final-review.ts");

  assert.equal(
    types.includes("supervisorCommentSummary: string | null;"),
    true,
    "employee payload type should include the concise supervisor comment summary field",
  );
  assert.equal(
    detailPanel.includes("初评评语摘要"),
    true,
    "employee evidence panel should display the supervisor comment summary label",
  );
  assert.equal(
    detailPanel.includes("employee.supervisorCommentSummary"),
    true,
    "employee evidence panel should render the new supervisor comment summary field",
  );
  assert.equal(
    payload.includes("candidComment") &&
      payload.includes("progressComment") &&
      payload.includes("altruismComment") &&
      payload.includes("rootComment"),
    true,
    "supervisor comment summary should pull from the real per-value comments written in supervisor reviews",
  );
});

test("employee selection and status labels follow official stars for primary confirmed state", () => {
  const page = read("src/app/(main)/calibration/page.tsx");
  const cockpit = read("src/components/final-review/employee-cockpit.tsx");
  const detailPanel = read("src/components/final-review/employee-detail-panel.tsx");

  assert.equal(
    page.includes("employees.find((employee: EmployeeRow) => employee.officialStars == null)"),
    true,
    "default employee selection should prioritize rows missing official stars",
  );
  assert.equal(
    page.includes("!employee.officialConfirmedAt"),
    false,
    "default employee selection should not use missing confirmation time anymore",
  );
  assert.equal(
    cockpit.includes('Badge variant={employee.officialStars == null ? "outline" : "secondary"}'),
    true,
    "left-side employee badges should use official stars for pending versus confirmed status",
  );
  assert.equal(
    detailPanel.includes('Badge variant={employee.officialStars == null ? "outline" : "default"}'),
    true,
    "detail panel status badge should use official stars for the primary confirmed state",
  );
  assert.equal(
    detailPanel.includes('employee.officialConfirmedAt ? "已拍板" : "待拍板"'),
    false,
    "detail panel should keep officialConfirmedAt for audit timing only, not the main status label",
  );
});

test("calibration page keeps the pending employee metric on the server overview field", () => {
  const page = read("src/app/(main)/calibration/page.tsx");

  assert.equal(
    page.includes("pendingOfficialCount={workspace.employeeReview.overview.pendingOfficialCount}"),
    true,
    "the live pending metric should keep using the server-provided overview count",
  );
});

test("navigation and dashboard can surface configured final review access beyond static roles", () => {
  const navSource = read("src/components/nav.tsx");
  const layoutSource = read("src/app/(main)/layout.tsx");
  const usersRoute = read("src/app/api/users/route.ts");
  const dashboardSource = read("src/app/(main)/dashboard/page.tsx");

  assert.equal(
    navSource.includes("canAccessFinalReview"),
    true,
    "navigation should use a dedicated final review access capability instead of role only",
  );
  assert.equal(
    layoutSource.includes("canAccessFinalReviewWorkspace"),
    true,
    "main layout should compute final review access for the current session user",
  );
  assert.equal(
    usersRoute.includes("canAccessFinalReview"),
    true,
    "me endpoint should expose whether the user can access the final review workspace",
  );
  assert.equal(
    dashboardSource.includes("canAccessFinalReview"),
    true,
    "dashboard should surface the final review card for configured workspace users",
  );
});

test("employee cockpit uses a searchable roster rail instead of select controls", () => {
  const cockpit = read("src/components/final-review/employee-cockpit.tsx");
  const detail = read("src/components/final-review/employee-detail-panel.tsx");

  assert.equal(
    cockpit.includes("搜索员工") && cockpit.includes("待拍板") && cockpit.includes("有分歧"),
    true,
    "employee cockpit should expose a searchable roster rail and queue-first navigation",
  );
  assert.equal(
    detail.includes("canViewOpinionDetails") && detail.includes("具名意见"),
    true,
    "employee detail panel should explicitly gate named process detail by visibility",
  );
  assert.equal(
    detail.includes("<select"),
    false,
    "employee detail panel should stop using raw select controls for decisions",
  );
});

test("leader cockpit uses a searchable roster rail and gates detailed dual-review content", () => {
  const cockpit = read("src/components/final-review/leader-cockpit.tsx");
  const detail = read("src/components/final-review/leader-detail-panel.tsx");

  assert.equal(
    cockpit.includes("搜索主管") && cockpit.includes("待拍板") && cockpit.includes("待双人齐备"),
    true,
    "leader cockpit should expose a searchable roster rail and queue-first navigation",
  );
  assert.equal(
    detail.includes("canViewLeaderEvaluationDetails") && detail.includes("详细双人问卷"),
    true,
    "leader detail panel should explicitly gate detailed dual-review content by visibility",
  );
  assert.equal(
    detail.includes("<select"),
    false,
    "leader detail panel should stop using raw select controls for confirmation",
  );
});

test("final review cockpits share the dedicated roster search list component", () => {
  const shared = read("src/components/final-review/roster-search-list.tsx");
  const employeeCockpit = read("src/components/final-review/employee-cockpit.tsx");
  const leaderCockpit = read("src/components/final-review/leader-cockpit.tsx");

  assert.equal(
    shared.includes("搜索结果") && shared.includes("Input"),
    true,
    "the shared roster search list should provide a searchable result rail",
  );
  assert.equal(
    employeeCockpit.includes('from "./roster-search-list"') && leaderCockpit.includes('from "./roster-search-list"'),
    true,
    "employee and leader cockpits should both use the shared roster search list component",
  );
});
