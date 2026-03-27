import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
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

  assert.equal(
    source.includes("原则") && source.includes("非主管员工终评") && source.includes("主管层双人终评"),
    true,
    "calibration page should expose the three final review tabs",
  );
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
