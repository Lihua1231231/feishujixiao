import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("peer review page allows zero-star unknown scores and auto-fills placeholder comments", () => {
  const source = read("src/app/(main)/peer-review/page.tsx");

  assert.equal(
    source.includes("review.performanceStars == null || review.comprehensiveStars == null || review.learningStars == null || review.adaptabilityStars == null || review.candidStars == null || review.progressStars == null || review.altruismStars == null || review.rootStars == null"),
    true,
    "peer review submit validation should only reject missing scores, not zero-star unknown values",
  );
  assert.equal(
    source.includes("function getUnknownComment(value: number, currentComment: string) {"),
    true,
    "peer review page should auto-fill comments when a dimension is marked unknown",
  );
  assert.equal(
    source.includes("return \"不了解\";"),
    true,
    "peer review page should reuse the unknown placeholder comment",
  );
  assert.equal(
    source.includes("review.performanceStars != null && review.performanceStars > 0 && !review.performanceComment?.trim()"),
    true,
    "peer review page should only require manual comments for scored dimensions",
  );
});

test("peer review API persists unknown scores as zero with fallback comments", () => {
  const source = read("src/app/api/peer-review/route.ts");

  assert.equal(
    source.includes("function normalizeUnknownComment(score: number | null, comment: unknown) {"),
    true,
    "peer review API should normalize unknown comments consistently",
  );
  assert.equal(
    source.includes("if (score === 0) return sanitized || \"不了解\";"),
    true,
    "peer review API should persist a fallback comment for zero-star unknown scores",
  );
  assert.equal(
    source.includes("if (performanceStars! > 0 && !performanceComment) missingComments.push(\"业绩产出\");"),
    true,
    "peer review API should continue requiring comments only for positive scores",
  );
});
