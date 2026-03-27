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
  const source = read("src/app/(main)/calibration/page.tsx");

  assertSourceContains(source, "原则", "calibration page should include the tab label \"原则\"");
  assertSourceContains(source, "非主管员工终评", "calibration page should include the tab label \"非主管员工终评\"");
  assertSourceContains(source, "主管层双人终评", "calibration page should include the tab label \"主管层双人终评\"");
  assert.equal(
    source.includes("参考星级由初评加权分换算"),
    true,
    "employee final review rows should explain where the reference star comes from",
  );
  assert.equal(
    source.includes("setInterval(loadWorkspace, 30000)"),
    true,
    "final review workspace should auto-refresh every 30 seconds",
  );
  assert.equal(
    source.includes("这一页告诉你本轮终评按什么原则看人、谁参与拍板、现在卡在哪"),
    true,
    "principles tab should explain its purpose in plain operator language",
  );
  assert.equal(
    source.includes("这一页处理普通员工终评：先看分布，再逐个员工留下意见，最后由最终确认人拍板"),
    true,
    "employee tab should explain the workflow in plain language",
  );
  assert.equal(
    source.includes("这一页只处理主管层终评：先由两位填写人分别打分，再由最终确认人统一拍板"),
    true,
    "leader tab should explain the workflow in plain language",
  );
  assert.equal(
    source.includes("5位终评相关人已完成的意见数"),
    true,
    "top progress cards should explain what the metric actually means",
  );
  assert.equal(
    source.includes("主管层问卷填写进度"),
    true,
    "leader submission card should use plain-language wording",
  );
});

test("calibration page source includes principles-tab redesign tokens", () => {
  const source = read("src/app/(main)/calibration/page.tsx");

  assertSourceContains(source, "原则", "principles tab should include the briefing anchor token \"原则\"");
  assertSourceContains(source, "全公司星级分布", "principles tab should include the overview token \"全公司星级分布\"");
  assertSourceContains(source, "分数带", "principles tab should include the cockpit metric token \"分数带\"");
  assertSourceContains(source, "一句话解读", "principles tab should include the summary token \"一句话解读\"");
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

test("calibration page keeps the pending employee metric on the server overview field", () => {
  const page = read("src/app/(main)/calibration/page.tsx");

  assert.equal(
    page.includes('OverviewMetricCard value={workspace.employeeReview.overview.pendingOfficialCount} title="待最终确认人数"'),
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
