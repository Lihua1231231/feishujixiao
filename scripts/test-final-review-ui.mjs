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

test("calibration page becomes a two-tab workspace centered on employees and leaders", () => {
  const page = read("src/app/(main)/calibration/page.tsx");
  const globals = read("src/app/globals.css");

  assert.equal(
    page.includes('from "@/components/final-review/principles-tab"'),
    false,
    "calibration page should stop importing the standalone principles tab",
  );
  assert.equal(
    page.includes("<TabsTrigger value=\"battlefield\">"),
    false,
    "calibration page should drop the standalone principles tab trigger",
  );
  assert.equal(
    page.includes("<TabsTrigger value=\"employees\">员工层绩效校准</TabsTrigger>") &&
      page.includes("<TabsTrigger value=\"leaders\">主管层双人终评</TabsTrigger>"),
    true,
    "calibration page should only expose the employee and leader calibration tabs",
  );
  assert.equal(
    page.includes("非主管员工终评") || page.includes("<TabsTrigger value=\"battlefield\">原则</TabsTrigger>"),
    false,
    "calibration page should stop showing the old first-page and non-supervisor tab labels",
  );
  assert.equal(
    page.includes("setInterval(loadWorkspace, 30000)"),
    true,
    "final review workspace should keep auto-refreshing every 30 seconds",
  );
  assert.equal(
    globals.includes("--cockpit-surface") && globals.includes("--cockpit-border"),
    true,
    "globals should keep the shared cockpit tokens after the tab reduction",
  );
});

test("calibration page source includes employee-tab redesign tokens", () => {
  const source = read("src/app/(main)/calibration/page.tsx");
  const cockpit = read("src/components/final-review/employee-cockpit.tsx");
  const departmentBoard = read("src/components/final-review/department-distribution-board.tsx");
  const detailPanel = read("src/components/final-review/employee-detail-panel.tsx");
  const roster = read("src/components/final-review/roster-search-list.tsx");

  assert.equal(
    cockpit.includes("第一步：公司分布总览") || cockpit.includes("第三步：逐一校准") || departmentBoard.includes("第二步：按团队分布"),
    false,
    "employee calibration should stop using step-by-step tutorial titles",
  );
  assert.equal(
    !cockpit.includes("距离截止") &&
      !cockpit.includes("分布偏离") &&
      !cockpit.includes("初评缺口") &&
      cockpit.includes("绩效校准进度"),
    true,
    "employee tab should remove the old first-page cards and collapse the top area into direct working metrics",
  );
  assert.equal(
    roster.includes("绩效初评等级（加权）"),
    true,
    "employee search results should show the weighted initial-review star label",
  );
  assertSourceContains(cockpit, "待双人校准", "employee tab should use the new dual-calibration pending label");
  assertSourceContains(cockpit, "两人不一致", "employee tab should call out disagreement as a first-class queue");
  assertSourceContains(source, "最终决策", "employee tab should include the decision panel token \"最终决策\"");
  assertSourceContains(detailPanel, "承霖校准", "employee detail panel should surface Chenglin's current calibration state");
  assertSourceContains(detailPanel, "邱翔校准", "employee detail panel should surface Qiuxiang's current calibration state");
  assert.equal(
    cockpit.includes("全公司绩效分布") && !cockpit.includes("员工层实时分布"),
    true,
    "employee page should end with a whole-company distribution chart instead of an employee-only temporary chart",
  );
  assert.equal(
    detailPanel.includes("参考星级来自初评加权分换算。普通员工终评只看承霖、邱翔两位校准人的结论；两人一致时，系统会自动形成官方结果。"),
    false,
    "employee detail panel should drop the extra explanatory sentence under the current decision block",
  );
  assert.equal(
    detailPanel.includes("承霖、邱翔尚未都完成当前员工的校准动作，系统暂时只保留参考星级。"),
    false,
    "employee detail panel should drop the extra explanatory paragraph under the agreement summary block",
  );
  assert.equal(
    source.includes("myOpinion?.hasSavedOpinion") &&
      source.includes("myOpinion.prefillDecision") &&
      source.includes("myOpinion.prefillSuggestedStars") &&
      source.includes("myOpinion.prefillReason"),
    true,
    "employee opinion form should initialize from the local prefill draft only when there is no completed saved opinion yet",
  );
  assert.equal(
    detailPanel.includes("已根据你之前的") &&
      detailPanel.includes("预填草稿") &&
      detailPanel.includes("确认保存后才会成为终评意见"),
    true,
    "employee detail panel should warn that imported same-person review content is only a local draft until the reviewer saves it",
  );
});

test("calibration page source includes leader-tab redesign tokens", () => {
  const source = read("src/app/(main)/calibration/page.tsx");
  const cockpit = read("src/components/final-review/leader-cockpit.tsx");

  assertSourceContains(source, "双人结果对照", "leader tab should include the comparison token \"双人结果对照\"");
  assert.equal(
    cockpit.includes("第一步：主管层双人终评总览") || cockpit.includes("第二步：逐个查看主管"),
    false,
    "leader tab should stop using step-by-step tutorial titles",
  );
  assertSourceContains(cockpit, "待双人提交", "leader tab should include the dual-submission waiting label");
  assertSourceContains(cockpit, "待生成结果", "leader tab should include the automatic-result waiting label");
  assertSourceContains(cockpit, "全公司最终分布", "leader tab should keep the company-final-distribution chart visible");
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
      !detailPanel.includes("过程留痕"),
    true,
    "leader detail panel should drop the old audit-trail section instead of keeping it behind a permission gate",
  );
});

test("employee detail panel removes the old opinion process and audit-trail blocks", () => {
  const detailPanel = read("src/components/final-review/employee-detail-panel.tsx");

  assert.equal(
    !detailPanel.includes("双人校准状态") &&
      !detailPanel.includes("过程留痕") &&
      !detailPanel.includes("employee.opinions.map((opinion) => ("),
    true,
    "employee detail panel should remove the old opinion timeline and audit trail sections entirely",
  );
});

test("employee evidence panel turns imported self-eval status into a direct jump link when a source URL exists", () => {
  const detailPanel = read("src/components/final-review/employee-detail-panel.tsx");

  assert.equal(
    detailPanel.includes("employee.selfEvalSourceUrl") &&
      detailPanel.includes("查看自评"),
    true,
    "employee detail panel should render a direct self-evaluation jump action when the source URL exists",
  );
  assert.equal(
    detailPanel.includes('target="_blank"') &&
      detailPanel.includes('rel="noreferrer"'),
    true,
    "self-evaluation jump action should open the original self-evaluation in a new tab",
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
    detailPanel.includes('leader.bothSubmitted ? `双人已齐备 · ${renderStars(leader.officialStars, "待自动生成")}` : "待双人提交"'),
    true,
    "leader detail panel should summarize the dual-review state directly in the current-decision block",
  );
  assert.equal(
    detailPanel.includes('leader.bothSubmitted ? "待生成结果" : "待双人提交"'),
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
    cockpit.includes("全部员工") && cockpit.includes("待双人校准") && cockpit.includes("两人不一致"),
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

test("employee evidence panel shows direct initial-review details plus named 360 feedback", () => {
  const detailPanel = read("src/components/final-review/employee-detail-panel.tsx");
  const types = read("src/components/final-review/types.ts");
  const payload = read("src/lib/final-review.ts");

  assert.equal(
    types.includes("initialReviewDetails: Array<{") &&
      types.includes("abilityBreakdown: Array<{") &&
      types.includes("valuesBreakdown: Array<{"),
    true,
    "employee payload type should carry structured initial-review dimensions instead of a flattened summary string",
  );
  assert.equal(
    detailPanel.includes("直属上级绩效初评明细") &&
      !detailPanel.includes("初评评语摘要"),
    true,
    "employee evidence panel should use the direct initial-review detail section instead of the old summary label",
  );
  assert.equal(
    payload.includes("candidComment") &&
      payload.includes("progressComment") &&
      payload.includes("altruismComment") &&
      payload.includes("rootComment"),
    true,
    "supervisor comment summary should pull from the real per-value comments written in supervisor reviews",
  );
  assert.equal(
    types.includes("peerReviewSummary: {") &&
      types.includes("performance: number | null;") &&
      types.includes("ability: number | null;") &&
      types.includes("values: number | null;") &&
      types.includes("canViewNamedPeerReviewers: boolean;") &&
      types.includes("reviewerName: string;") &&
      types.includes("reviews: Array<{"),
    true,
    "employee payload type should include an expandable 360 summary model instead of just a flat average number",
  );
  assert.equal(
    detailPanel.includes("点击查看360详情") &&
      detailPanel.includes("收起360详情") &&
      detailPanel.includes("360反馈详情") &&
      detailPanel.includes("employee.canViewNamedPeerReviewers") &&
      detailPanel.includes("匿名反馈") &&
      detailPanel.includes("employee.peerReviewSummary"),
    true,
    "employee evidence panel should expand 360 details inline and switch between named and anonymous labels based on the viewer",
  );
  assert.equal(
    payload.includes('new Set(["吴承霖", "邱翔", "禹聪琪"])'),
    true,
    "final review payload should only expose named 360 reviewers to the three approved viewers",
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
    detailPanel.includes("当前结论") &&
      detailPanel.includes("承霖校准") &&
      detailPanel.includes("邱翔校准") &&
      detailPanel.includes("是否同意绩效初评"),
    true,
    "employee detail panel should show the two company calibrators directly with agree-or-change guidance",
  );
});

test("employee calibration page follows the latest redline simplification", () => {
  const page = read("src/app/(main)/calibration/page.tsx");
  const cockpit = read("src/components/final-review/employee-cockpit.tsx");
  const detailPanel = read("src/components/final-review/employee-detail-panel.tsx");
  const board = read("src/components/final-review/department-distribution-board.tsx");

  assert.equal(
    page.includes('title="公司级绩效终评校准"') &&
      !cockpit.includes("距离截止") &&
      !cockpit.includes("分布偏离") &&
      !cockpit.includes("初评缺口") &&
      cockpit.includes("绩效校准进度") &&
      cockpit.includes("双人已一致") &&
      cockpit.includes("待双人一致"),
    true,
    "employee calibration should remove the extra top summary cards and replace them with one compact dual-calibration progress card",
  );

  assert.equal(
    cockpit.includes("绩效初评等级（加权）") &&
      board.includes("可左右滑动查看全部部门") &&
      board.includes("员工层名单（不含主管层）"),
    true,
    "employee roster results should show weighted initial stars and the department rail should clarify the horizontal swipe behavior",
  );

  assert.equal(
    detailPanel.includes("直属上级绩效初评明细") &&
      detailPanel.includes("初评加权方式") &&
      detailPanel.includes("是否同意绩效初评") &&
      !detailPanel.includes("双人校准状态") &&
      !detailPanel.includes("过程留痕") &&
      !detailPanel.includes("参考说明") &&
      !detailPanel.includes("初评评语摘要"),
    true,
    "employee detail should switch from generic summaries and audit blocks to direct initial-review detail plus two explicit calibrator boxes",
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

test("department distribution board uses department cards to switch one clean chart view", () => {
  const board = read("src/components/final-review/department-distribution-board.tsx");

  assert.equal(
    board.includes('useState<"all" | string>("all")') &&
      board.includes("员工层名单（不含主管层）") &&
      board.includes("setActiveDepartmentKey") &&
      board.includes("selectedDepartment") &&
      board.includes("polyline") &&
      !board.includes("部门图例") &&
      !board.includes("departmentColors") &&
      !board.includes("读图提示") &&
      !board.includes("默认先看全公司。点击部门卡片后，下方同一张图会切到该部门视角；这样能快速看全局，也不会把页面拉得很长。"),
    true,
    "the department distribution board should keep one shared chart but remove the long teaching copy and side explanations",
  );
});

test("department distribution board renders the chosen light narrow-bar style", () => {
  const board = read("src/components/final-review/department-distribution-board.tsx");

  assert.equal(
    board.includes("mx-auto w-[46%]") &&
      board.includes("rounded-[10px] rounded-b-[6px]") &&
      board.includes("bg-[color:#e97a73]") &&
      board.includes("bg-[color:#d8c0a3]") &&
      board.includes("strokeWidth=\"1.6\"") &&
      !board.includes("bg-gradient-to-b") &&
      !board.includes("shadow-[0_16px_28px_rgba(168,93,37,0.18)]"),
    true,
    "the team distribution chart should use the lighter narrow-bar treatment instead of heavy rounded gradient blocks",
  );
});

test("department distribution board keeps names out of bars and moves them into a focused detail rail", () => {
  const board = read("src/components/final-review/department-distribution-board.tsx");

  assert.equal(
    board.includes("activeStar") &&
      board.includes("setActiveStarOverride") &&
      board.includes("当前查看") &&
      board.includes("点击柱子切换名单") &&
      board.includes("selectedBucket") &&
      board.includes("selectedBucket.names") &&
      board.includes("onClick={() => setActiveStarOverride(item.stars)}") &&
      !board.includes("compactNames(item.names)") &&
      !board.includes("line-clamp-3"),
    true,
    "the team distribution chart should keep bars clean and show the selected star's names in a separate detail area below",
  );
});

test("employee detail panel keeps non-calibrator viewers on read-only dual-review summaries", () => {
  const detailPanel = read("src/components/final-review/employee-detail-panel.tsx");

  assert.equal(
    detailPanel.includes("这里直接看承霖、邱翔各自的校准结论；只有具备权限的人才展开改星理由。"),
    false,
    "employee detail panel should remove the extra instructional copy above the dual-review summary",
  );
  assert.equal(
    detailPanel.includes("当前视图只保留汇总口径，不展开承霖、邱翔的补充理由原文。"),
    false,
    "employee detail panel should stop explaining the permission model with extra prose",
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
    cockpit.includes('status: employee.summaryStats.disagreementCount > 0 ? "两人不一致" : employee.officialStars == null ? "待双人校准" : "已形成结果"') &&
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
    detailPanel.includes("待双人校准"),
    true,
    "detail panel should use the dual-calibration pending label in its primary status copy",
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

  assert.equal(
    cockpit.includes("搜索员工") && cockpit.includes("待双人校准") && cockpit.includes("两人不一致") && cockpit.includes("全部员工"),
    true,
    "employee cockpit should expose a searchable roster rail and the new dual-calibration queue navigation",
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
    detail.includes("editable={Boolean(employee.canSubmitOpinion && chenglinOpinion?.isMine)}") &&
      detail.includes("editable={Boolean(employee.canSubmitOpinion && qiuxiangOpinion?.isMine)}"),
    true,
    "employee detail panel should only render the write-action card for users who are allowed to participate in named employee opinions",
  );
});

test("leader cockpit uses a searchable roster rail, queue tabs, and a single-person detail flow", () => {
  const cockpit = read("src/components/final-review/leader-cockpit.tsx");
  const detail = read("src/components/final-review/leader-detail-panel.tsx");

  assert.equal(
    cockpit.includes("搜索主管") && cockpit.includes("待双人提交") && cockpit.includes("待生成结果") && cockpit.includes("全部主管"),
    true,
    "leader cockpit should expose a searchable roster rail and queue-first navigation",
  );
  assert.equal(
    detail.includes("当前结论") && detail.includes("双人结果对照") && !detail.includes("过程留痕"),
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
