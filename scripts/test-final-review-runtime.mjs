import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");

function runLogic(expression) {
  const output = execFileSync(
    "npx",
    [
      "tsx",
      "--eval",
      `
        import {
          buildInitialDimensionChecks,
          resolveEmployeeConsensus,
          resolveLeaderFinalDecision,
        } from ${JSON.stringify(`file://${path.join(rootDir, "src/lib/final-review-logic.ts")}`)};

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

test("runtime employee consensus only resolves when both company calibrators reach the same non-pending star", () => {
  const agreed = runLogic(`resolveEmployeeConsensus(
    ["u1", "u2"],
    [
      { reviewerId: "u1", decision: "AGREE", suggestedStars: 4, reason: "" },
      { reviewerId: "u2", decision: "OVERRIDE", suggestedStars: 4, reason: "更稳妥" },
    ],
  )`);
  const disagreed = runLogic(`resolveEmployeeConsensus(
    ["u1", "u2"],
    [
      { reviewerId: "u1", decision: "AGREE", suggestedStars: 4, reason: "" },
      { reviewerId: "u2", decision: "OVERRIDE", suggestedStars: 5, reason: "更激进" },
    ],
  )`);

  assert.equal(agreed.agreed, true);
  assert.equal(agreed.officialStars, 4);
  assert.equal(disagreed.disagreed, true);
  assert.equal(disagreed.officialStars, null);
});

test("runtime leader dual-review result uses 50/50 combined weighted score and shared star ranges", () => {
  const result = runLogic(`resolveLeaderFinalDecision(
    ["u1", "u2"],
    [
      { evaluatorId: "u1", weightedScore: 4.4, status: "SUBMITTED" },
      { evaluatorId: "u2", weightedScore: 3.6, status: "SUBMITTED" },
    ],
    [
      { stars: 1, min: 0, max: 1.49 },
      { stars: 2, min: 1.5, max: 2.49 },
      { stars: 3, min: 2.5, max: 3.49 },
      { stars: 4, min: 3.5, max: 4.49 },
      { stars: 5, min: 4.5, max: 5 },
    ],
  )`);

  assert.equal(result.ready, true);
  assert.equal(result.combinedWeightedScore, 4);
  assert.equal(result.officialStars, 4);
});

test("runtime initial-dimension check treats a fully filled draft as complete instead of missing", () => {
  const result = runLogic(`buildInitialDimensionChecks([
    {
      id: "u1",
      name: "张三",
      department: "工程",
      performanceStars: 4,
      abilityStars: 4,
      valuesStars: 4,
      performanceComment: "有结果",
      abilityComment: "有能力评价",
      valuesComment: "",
      candidComment: "坦诚真实有评价",
      progressComment: "极致进取有评价",
      altruismComment: "成就利他有评价",
      rootComment: "ROOT有评价",
    },
    {
      id: "u2",
      name: "李四",
      department: "工程",
      performanceStars: null,
      abilityStars: 4,
      valuesStars: 4,
      performanceComment: "",
      abilityComment: "有能力评价",
      valuesComment: "",
      candidComment: "坦诚真实有评价",
      progressComment: "极致进取有评价",
      altruismComment: "成就利他有评价",
      rootComment: "",
    },
  ])`);

  assert.equal(result.completeCount, 1);
  assert.equal(result.missingCount, 1);
  assert.deepEqual(result.items[0].missingDimensions, ["业绩产出结果", "价值观"]);
});
