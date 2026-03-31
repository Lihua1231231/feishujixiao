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

test("supervisor-eval GET no longer phase-gates editing", () => {
  const route = read("src/app/api/supervisor-eval/route.ts");

  assert.equal(
    route.includes("const canEdit = true;"),
    true,
    "supervisor-eval GET should treat the page as editable in any cycle stage",
  );
  assert.equal(
    route.includes("const lockedReason = null;"),
    true,
    "supervisor-eval GET should stop exposing a phase-based lock reason",
  );
  assert.equal(
    route.includes("return NextResponse.json({") &&
      route.includes("cycleStatus: cycle.status") &&
      route.includes("canEdit,") &&
      route.includes("items: result"),
    true,
    "supervisor-eval GET should return the cycle status and editability metadata alongside the evaluation rows",
  );
  assert.equal(
    route.includes("当前不在上级评估阶段，无法执行此操作"),
    false,
    "supervisor-eval POST should no longer reject writes based on cycle stage",
  );
});

test("team page no longer becomes read-only outside supervisor-eval stage", () => {
  const source = read("src/app/(main)/team/page.tsx");

  assert.equal(
    source.includes("const isReadOnly = Boolean(isSubmitted) && !canEditSubmitted;"),
    true,
    "team page should only stay read-only for truly submitted records",
  );
  assert.equal(
    source.includes("当前不是上级初评阶段，无法保存或提交"),
    false,
    "team page should stop blocking saves and submits with a phase-specific toast",
  );
  assert.equal(
    source.includes("{!isReadOnly && ("),
    true,
    "team page should hide save and submit actions once the page is read-only",
  );
});
