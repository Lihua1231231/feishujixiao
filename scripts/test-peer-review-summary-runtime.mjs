import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");

function runPeerReviewLogic(expression) {
  const output = execFileSync(
    "npx",
    [
      "tsx",
      "--eval",
      `
        import {
          buildPeerReviewCategorySummary,
          computePeerReviewAverageFromReviews,
        } from ${JSON.stringify(`file://${path.join(rootDir, "src/lib/peer-review-summary.ts")}`)};

        const result = (${expression});
        console.log(JSON.stringify(result));
      `,
    ],
    {
      cwd: rootDir,
      encoding: "utf8",
    },
  );

  return JSON.parse(output.trim().split("\n").at(-1));
}

test("peer review averages use the new eight-dimension scores when legacy fields are empty", () => {
  const average = runPeerReviewLogic(`computePeerReviewAverageFromReviews([
    {
      outputScore: null,
      collaborationScore: null,
      valuesScore: null,
      performanceStars: 5,
      comprehensiveStars: 4,
      learningStars: 4,
      adaptabilityStars: 3,
      candidStars: 5,
      progressStars: 4,
      altruismStars: 4,
      rootStars: 3,
    },
  ])`);

  assert.equal(average, 4.0);
});

test("peer review summary maps new fields into performance, ability, and values categories", () => {
  const summary = runPeerReviewLogic(`buildPeerReviewCategorySummary([
    {
      outputScore: null,
      collaborationScore: null,
      valuesScore: null,
      performanceStars: 5,
      comprehensiveStars: 4,
      learningStars: 4,
      adaptabilityStars: 3,
      candidStars: 5,
      progressStars: 4,
      altruismStars: 4,
      rootStars: 3,
    },
    {
      outputScore: null,
      collaborationScore: null,
      valuesScore: null,
      performanceStars: 3,
      comprehensiveStars: 3,
      learningStars: 3,
      adaptabilityStars: 3,
      candidStars: 4,
      progressStars: 4,
      altruismStars: 4,
      rootStars: 4,
    },
  ])`);

  assert.deepEqual(summary, {
    performance: 4.0,
    ability: 3.4,
    values: 4.0,
    overall: 3.8,
  });
});
