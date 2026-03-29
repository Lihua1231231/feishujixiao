import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("team page stops showing fake success when supervisor-eval POST fails", () => {
  const source = read("src/app/(main)/team/page.tsx");

  assert.equal(
    source.includes("const res = await fetch(\"/api/supervisor-eval\""),
    true,
    "team page should keep the POST response object instead of ignoring it",
  );
  assert.equal(
    source.includes("if (!res.ok) throw new Error(result.error || \"操作失败\");"),
    true,
    "team page should surface the backend error when save or submit is rejected",
  );
  assert.equal(
    source.includes("await fetch(\"/api/supervisor-eval\",") &&
      source.includes("toast.success(action === \"submit\" ? \"评估已提交\" : \"已保存\");"),
    true,
    "team page should only show success after the POST has been checked",
  );
});

test("supervisor-eval GET exposes whether the current cycle is still editable", () => {
  const route = read("src/app/api/supervisor-eval/route.ts");

  assert.equal(
    route.includes("const canEdit = user.role === \"ADMIN\" || cycle.status === \"SUPERVISOR_EVAL\";"),
    true,
    "supervisor-eval GET should compute whether the current session can still edit in this cycle stage",
  );
  assert.equal(
    route.includes("const lockedReason = canEdit ? null : \"当前不是上级初评阶段，页面只保留查看\";"),
    true,
    "supervisor-eval GET should expose a plain locked reason for the UI",
  );
  assert.equal(
    route.includes("return NextResponse.json({") &&
      route.includes("cycleStatus: cycle.status") &&
      route.includes("canEdit,") &&
      route.includes("items: result"),
    true,
    "supervisor-eval GET should return the cycle status and editability metadata alongside the evaluation rows",
  );
});

test("team page becomes read-only outside supervisor-eval stage", () => {
  const source = read("src/app/(main)/team/page.tsx");

  assert.equal(
    source.includes("const isReadOnly = !!isSubmitted || (!teamMeta.canEdit && !preview);"),
    true,
    "team page should combine submit lock and cycle-stage lock into one read-only flag",
  );
  assert.equal(
    source.includes("teamMeta.lockedReason"),
    true,
    "team page should render the backend-provided read-only reason",
  );
  assert.equal(
    source.includes("{!isReadOnly && ("),
    true,
    "team page should hide save and submit actions once the page is read-only",
  );
});
