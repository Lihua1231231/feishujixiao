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

test("admin final review config uses roster cards instead of multi-select lists", () => {
  const source = read("src/app/(main)/admin/page.tsx");
  const rosterCard = read("src/components/final-review/member-roster-card.tsx");

  assert.equal(
    source.includes('from "@/components/final-review/member-roster-card"'),
    true,
    "admin final review config should use the reusable member roster card",
  );
  assert.equal(
    source.includes("employeeSubjectUserIds"),
    true,
    "admin final review config should include the ordinary employee final-review roster",
  );
  assert.equal(
    source.includes("普通员工终评名单"),
    true,
    "admin final review config should label the ordinary employee roster clearly",
  );
  assert.equal(
    source.includes("multiple"),
    false,
    "admin final review config should stop using native multi-select lists for member management",
  );
  assert.equal(
    rosterCard.includes("已选成员") && rosterCard.includes("搜索成员") && rosterCard.includes("添加"),
    true,
    "admin final review config should expose a search-add/remove member card instead of a browser multi-select",
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
    page.includes("这一页用于逐个处理普通员工终评：上方先看公司当前绩效分布总览和按团队分布"),
    true,
    "employee tab should explain the queue-first panel workflow in plain language",
  );
  assert.equal(
    page.includes("这一页用于逐个处理主管层终评：先看主管层正式分布和双人提交进度"),
    true,
    "leader tab should explain the single-person leader workflow in plain language",
  );
  assert.equal(
    principles.includes("具名拍板人已完成的意见数"),
    false,
    "principles tab should stop describing ordinary employee calibration as a generic named-opinion collection process",
  );
  assert.equal(
    principles.includes("主管层问卷填写进度"),
    true,
    "leader submission card should use plain-language wording",
  );
  assert.equal(
    principles.includes("吴承霖、邱翔分别已提交多少份主管层问卷"),
    false,
    "principles tab should not hardcode named leader reviewers into summary copy that ordinary viewers can see",
  );
  assert.equal(
    principles.includes("公司级绩效终评校准人") &&
      principles.includes("初评维度检查") &&
      principles.includes("分布符合性检查"),
    true,
    "principles tab should surface the company calibrators and the two explicit principle-check sections",
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

  assertSourceContains(source, "处理队列", "employee tab should include the navigation token \"处理队列\"");
  assertSourceContains(source, "待拍板", "employee tab should include the queue status token \"待拍板\"");
  assertSourceContains(source, "有分歧", "employee tab should include the triage token \"有分歧\"");
  assertSourceContains(source, "最终决策", "employee tab should include the decision panel token \"最终决策\"");
  assertSourceContains(source, "按团队分布", "employee tab should include the team-distribution section token \"按团队分布\"");
});

test("calibration page source includes leader-tab redesign tokens", () => {
  const source = read("src/app/(main)/calibration/page.tsx");

  assertSourceContains(source, "双人意见摘要", "leader tab should include the comparison token \"双人意见摘要\"");
  assertSourceContains(source, "处理队列", "leader tab should include the progress token \"处理队列\"");
  assertSourceContains(source, "全部主管", "leader tab should include the roster token \"全部主管\"");
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

test("self-eval preview mode resolves content synchronously and skips the loading skeleton", () => {
  const source = read("src/app/(main)/self-eval/page.tsx");

  assert.equal(
    source.includes('const previewData = preview && previewRole ? getData("self-eval") : null;'),
    true,
    "self-eval preview should derive preview content directly from the preview hook",
  );
  assert.equal(
    source.includes('const isPreviewEmployee = preview && previewRole === "EMPLOYEE";'),
    true,
    "self-eval preview should still distinguish employee preview from supervisor/admin preview",
  );
  assert.equal(
    source.includes("if (!preview && loading) {"),
    true,
    "self-eval should only show the loading skeleton outside preview mode",
  );
  assert.equal(
    source.includes("if (preview && previewRole && previewRole !== \"EMPLOYEE\") {"),
    true,
    "self-eval should render supervisor and admin preview views directly",
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
  assert.equal(
    detailPanel.includes("leader.canViewLeaderEvaluationDetails ? (") &&
      detailPanel.includes("当前视图只保留官方结论和双人提交摘要，不展示每位填写人的留痕。"),
    true,
    "leader detail panel should hide the named audit trail behind the same permission gate as the rest of the detailed dual-review content",
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

test("calibration page no longer drives manual employee or leader final-confirm calls", () => {
  const source = read("src/app/(main)/calibration/page.tsx");

  assert.equal(
    source.includes("/api/final-review/confirm"),
    false,
    "ordinary employee calibration should stop calling the legacy manual final-confirm endpoint",
  );
  assert.equal(
    source.includes("/api/final-review/leader/confirm"),
    false,
    "leader calibration should stop calling the legacy manual leader-confirm endpoint",
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

test("leader detail panel explains auto-generation after dual submission", () => {
  const detailPanel = read("src/components/final-review/leader-detail-panel.tsx");

  assert.equal(
    detailPanel.includes("系统会按 50/50 形成加权后结果"),
    true,
    "leader detail panel should explain that the official result is auto-generated after both questionnaires are submitted",
  );
  assert.equal(
    detailPanel.includes('leader.bothSubmitted ? "待系统生成" : "待双人齐备"') || detailPanel.includes('leader.bothSubmitted ? "待系统生成" : "待双人齐备"'),
    true,
    "leader detail panel should distinguish dual-review waiting from system-generation waiting",
  );
  assert.equal(
    detailPanel.includes("加权后结果") && detailPanel.includes("各自等级"),
    true,
    "leader detail panel should surface the per-reviewer grades and the combined weighted result",
  );
});

test("employee cockpit keeps a reachable all-employee roster alongside queue tabs", () => {
  const cockpit = read("src/components/final-review/employee-cockpit.tsx");
  const roster = read("src/components/final-review/roster-search-list.tsx");

  assert.equal(
    cockpit.includes("全部员工") && cockpit.includes("待拍板") && cockpit.includes("有分歧"),
    true,
    "the employee cockpit should include queue tabs plus a dedicated all-employee roster so confirmed employees stay reachable",
  );
  assert.equal(
    cockpit.includes("queuePanelHeight") &&
      cockpit.includes("detailPanelRef") &&
      cockpit.includes("ResizeObserver") &&
      cockpit.includes("ref={detailPanelRef}") &&
      cockpit.includes("xl:overflow-hidden"),
    true,
    "the employee cockpit should sync the left queue rail height to the current right-side panel and keep the roster scrolling inside it",
  );
  assert.equal(
    roster.includes("max-h-[420px]"),
    false,
    "the roster search list should stop hard-capping its visible height to a short scroll box",
  );
  assert.equal(
    roster.includes("xl:flex-1 xl:overflow-auto"),
    true,
    "the roster search list should only become scrollable after it has stretched to fill the taller queue rail",
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
    detailPanel.includes("展开全文") && detailPanel.includes("收起全文") && detailPanel.includes("line-clamp-4"),
    true,
    "employee evidence panel should keep the supervisor summary collapsed by default and allow expanding it inline",
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

test("employee detail panel switches from third-person final confirmation to dual-calibrator alignment", () => {
  const detailPanel = read("src/components/final-review/employee-detail-panel.tsx");

  assert.equal(
    detailPanel.includes("最终确认"),
    false,
    "employee detail panel should no longer render a separate final-confirm action block",
  );
  assert.equal(
    detailPanel.includes("校准结论") && detailPanel.includes("两位校准人"),
    true,
    "employee detail panel should summarize whether the two company calibrators already agree on the same star result",
  );
});

test("leader detail panel switches from third-person confirmation to dual-review weighted output", () => {
  const detailPanel = read("src/components/final-review/leader-detail-panel.tsx");

  assert.equal(
    detailPanel.includes("最终确认"),
    false,
    "leader detail panel should no longer render a separate third-person confirmation block",
  );
  assert.equal(
    detailPanel.includes("加权后结果") && detailPanel.includes("各自等级"),
    true,
    "leader detail panel should show the two questionnaire scores separately plus the combined weighted result",
  );
});

test("principles tab packs role and risk guidance into one dense side panel", () => {
  const principles = read("src/components/final-review/principles-tab.tsx");

  assert.equal(
    principles.includes("本轮终评角色与提醒"),
    true,
    "the principles tab should combine roles and reminders into one denser side panel to reduce empty space",
  );
  assert.equal(
    principles.includes(">本轮终评角色</CardTitle>") || principles.includes(">风险与推进提醒</CardTitle>"),
    false,
    "the principles tab should stop splitting the side rail into two separate sparse cards",
  );
  assert.equal(
    principles.includes("CardContent className=\"grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]\"") &&
      principles.includes("xl:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]"),
    true,
    "the principles tab should repack role and reminder content into a denser two-column side panel to reduce blank space",
  );
});

test("leader cockpit mirrors the taller left rail layout used in the employee cockpit", () => {
  const cockpit = read("src/components/final-review/leader-cockpit.tsx");

  assert.equal(
    cockpit.includes("queuePanelHeight") &&
      cockpit.includes("detailPanelRef") &&
      cockpit.includes("ResizeObserver") &&
      cockpit.includes("ref={detailPanelRef}") &&
      cockpit.includes("xl:overflow-hidden"),
    true,
    "the leader cockpit should also sync the left queue rail height to the active right-side panel and keep the roster scrolling inside it",
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
    cockpit.includes('status: employee.summaryStats.disagreementCount > 0 ? "有分歧" : employee.officialStars == null ? "待拍板" : "已确认"') &&
      cockpit.includes('tone: employee.summaryStats.disagreementCount > 0 ? "destructive" : employee.officialStars == null ? "outline" : "secondary"'),
    true,
    "left-side employee roster items should surface direct disagreement ahead of generic pending state",
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

test("employee cockpit uses a searchable roster rail and a collapsible distribution drawer", () => {
  const cockpit = read("src/components/final-review/employee-cockpit.tsx");
  const detail = read("src/components/final-review/employee-detail-panel.tsx");
  const queueTabs = read("src/components/final-review/queue-tabs.tsx");
  const distributionDrawer = read("src/components/final-review/distribution-drawer.tsx");

  assert.equal(
    cockpit.includes("搜索员工") && cockpit.includes("待拍板") && cockpit.includes("有分歧") && cockpit.includes("全部员工"),
    true,
    "employee cockpit should expose a searchable roster rail and queue-first navigation",
  );
  assert.equal(
    distributionDrawer.includes("查看整体分布") && distributionDrawer.includes("收起整体分布"),
    true,
    "employee cockpit should move company-wide context behind a shared collapsible distribution drawer",
  );
  assert.equal(
    queueTabs.includes("items") && queueTabs.includes("activeKey") && queueTabs.includes("onChange"),
    true,
    "queue tabs should be extracted into a shared component instead of being hand-built inside each cockpit",
  );
  assert.equal(
    detail.includes("已确认，可切换下一位"),
    true,
    "employee detail panel should keep the confirmed employee in place and show the explicit next-step hint",
  );
});

test("ordinary employee opinion panel only gives named slots and write actions to the configured finalizers", () => {
  const detail = read("src/components/final-review/employee-detail-panel.tsx");
  const payload = read("src/lib/final-review.ts");

  assert.equal(
    payload.includes("const employeeOpinionActorIds = [...new Set(config.finalizerUserIds)].slice(0, 2);"),
    true,
    "employee opinion cards should be built from the finalizer roster instead of every workspace viewer",
  );
  assert.equal(
    payload.includes("totalReviewerCount: employeeOpinionActorIds.length") &&
      payload.includes("employeeOpinionTotal: employeeRows.length * Math.max(employeeOpinionActorIds.length, 1)"),
    true,
    "employee opinion totals should track only the named finalizers who are allowed to participate",
  );
  assert.equal(
    detail.includes("employee.canSubmitOpinion && myOpinion ? ("),
    true,
    "employee detail panel should only render the write-action card for users who are allowed to participate in named employee opinions",
  );
});

test("leader cockpit uses a searchable roster rail, queue tabs, and a single-person detail flow", () => {
  const cockpit = read("src/components/final-review/leader-cockpit.tsx");
  const detail = read("src/components/final-review/leader-detail-panel.tsx");

  assert.equal(
    cockpit.includes("搜索主管") && cockpit.includes("待拍板") && cockpit.includes("待双人齐备") && cockpit.includes("全部主管"),
    true,
    "leader cockpit should expose a searchable roster rail and queue-first navigation",
  );
  assert.equal(
    detail.includes("当前结论") && detail.includes("双人意见摘要") && detail.includes("过程留痕"),
    true,
    "leader detail panel should follow the single-person decision flow",
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
