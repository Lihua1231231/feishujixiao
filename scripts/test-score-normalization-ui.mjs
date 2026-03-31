import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("score normalization page exposes the two required analysis tabs", () => {
  const source = read("src/app/(main)/score-normalization/page.tsx");

  assert.equal(
    source.includes("360环评分布校准"),
    true,
    "score normalization page should expose the 360 review distribution calibration tab",
  );
  assert.equal(
    source.includes("绩效初评分布校准"),
    true,
    "score normalization page should expose the performance initial-review distribution calibration tab",
  );
});

test("score normalization page includes double-confirm apply and rollback copy", () => {
  const source = read("src/components/score-normalization/apply-panel.tsx");

  assert.equal(
    source.includes("我已理解这会影响排名和后续校准展示"),
    true,
    "apply panel should require the double-confirm acknowledgment copy",
  );
  assert.equal(
    source.includes("应用标准化结果"),
    true,
    "apply panel should use the apply wording for normalized results",
  );
  assert.equal(
    source.includes("回退到原始分"),
    true,
    "apply panel should expose the rollback wording back to raw scores",
  );
});
