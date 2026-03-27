import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("peer review page keeps non-terminal review statuses editable", () => {
  const source = read("src/app/(main)/peer-review/page.tsx");

  assert.equal(
    source.includes("function getReviewStatusMeta(status: string): {"),
    true,
    "peer review page should centralize review status handling",
  );
  assert.equal(
    source.includes("const isDisabled = statusMeta.terminal;"),
    true,
    "peer review form should only disable submitted or declined records",
  );
  assert.equal(
    source.includes("const editableCount = reviews.filter(r => r.status !== \"SUBMITTED\" && r.status !== \"DECLINED\").length;"),
    true,
    "peer review tab count should include any editable non-terminal status",
  );
});

test("peer review page does not disguise unexpected statuses as generic pending", () => {
  const source = read("src/app/(main)/peer-review/page.tsx");

  assert.equal(
    source.includes("return { label: `异常状态: ${status}`, variant: \"outline\", terminal: false, isUnexpected: true };"),
    true,
    "unexpected review statuses should be labeled explicitly",
  );
  assert.equal(
    source.includes("statusMeta.isUnexpected && ("),
    true,
    "peer review page should surface an explicit warning for unexpected review statuses",
  );
});

test("dashboard pending peer review count includes all non-terminal statuses", () => {
  const source = read("src/app/api/users/route.ts");

  assert.equal(
    source.includes("status: { notIn: [\"SUBMITTED\", \"DECLINED\"] }"),
    true,
    "dashboard pending count should not hide PENDING peer reviews",
  );
});
