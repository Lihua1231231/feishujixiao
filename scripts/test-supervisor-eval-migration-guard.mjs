import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), "utf8");
}

test("prod migration repairs the old supervisor-eval unique index before creating the evaluator-aware index", () => {
  const source = read("scripts/migrate-prod.ts");

  assert.match(
    source,
    /DROP INDEX IF EXISTS SupervisorEval_cycleId_employeeId_key/,
    "prod migration should remove the legacy cycleId+employeeId unique index",
  );

  assert.match(
    source,
    /CREATE UNIQUE INDEX IF NOT EXISTS SupervisorEval_cycleId_employeeId_evaluatorId_key ON SupervisorEval\(cycleId, employeeId, evaluatorId\)/,
    "prod migration should recreate the evaluator-aware unique index",
  );
});
