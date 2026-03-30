import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");

function runWeighted(expression) {
  const output = execFileSync(
    "npx",
    [
      "tsx",
      "--eval",
      `
        import {
          computeAbilityAverage,
          computeValuesAverage,
          computeWeightedScoreFromDimensions,
        } from ${JSON.stringify(`file://${path.join(rootDir, "src/lib/weighted-score.ts")}`)};

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

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("weighted score uses exact sub-dimension averages before applying 50/30/20 weights", () => {
  const result = runWeighted(`({
    abilityAverage: computeAbilityAverage(4, 4, 3),
    valuesAverage: computeValuesAverage(5, 4, 4, 5),
    weightedScore: computeWeightedScoreFromDimensions({
      performanceStars: 3,
      comprehensiveStars: 4,
      learningStars: 4,
      adaptabilityStars: 3,
      candidStars: 5,
      progressStars: 4,
      altruismStars: 4,
      rootStars: 5,
    }),
  })`);

  assert.equal(result.abilityAverage, 3.7);
  assert.equal(result.valuesAverage, 4.5);
  assert.equal(
    result.weightedScore,
    3.5,
    "weighted score should use exact sub-averages and only round once at the final one-decimal display value",
  );
});

test("supervisor and leader scoring paths both use the shared precise weighted-score helper", () => {
  const supervisorRoute = read("src/app/api/supervisor-eval/route.ts");
  const teamPage = read("src/app/(main)/team/page.tsx");
  const leaderRoute = read("src/app/api/final-review/leader/route.ts");
  const leaderDetail = read("src/components/final-review/leader-detail-panel.tsx");
  const finalReviewHelper = read("src/lib/final-review.ts");
  const recomputeScript = read("scripts/recompute-weighted-scores.mjs");

  assert.equal(
    supervisorRoute.includes("computeWeightedScoreFromDimensions"),
    true,
    "supervisor-eval API should compute weighted score from the exact sub-dimension averages",
  );
  assert.equal(
    teamPage.includes("computeWeightedScoreFromDimensions"),
    true,
    "team page should preview the same exact weighted-score formula as the backend",
  );
  assert.equal(
    leaderRoute.includes("computeWeightedScoreFromDimensions"),
    true,
    "leader final-review API should use the same exact weighted-score formula",
  );
  assert.equal(
    leaderDetail.includes("computeWeightedScoreFromDimensions"),
    true,
    "leader detail panel should preview the same exact weighted-score formula",
  );
  assert.equal(
    finalReviewHelper.includes("return computeWeightedScore(performanceStars, abilityStars, valuesStars);"),
    true,
    "final review helper should reuse the shared rounded weighted-score function for any bucket-based calculations",
  );
  assert.equal(
    recomputeScript.includes(`await updateTable("SupervisorEval")`) &&
      recomputeScript.includes(`await updateTable("LeaderFinalReview")`),
    true,
    "a recompute script should backfill existing weighted scores in both supervisor and leader review tables",
  );
});
