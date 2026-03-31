import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("schema adds a separate normalization snapshot layer instead of overwriting raw reviews", () => {
  const source = read("prisma/schema.prisma");

  assert.equal(
    source.includes("model ScoreNormalizationSnapshot"),
    true,
    "schema should define a dedicated snapshot layer for normalization runs",
  );
  assert.equal(
    source.includes("model ScoreNormalizationEntry"),
    true,
    "schema should define per-record normalization entries",
  );
  assert.equal(
    source.includes("model ScoreNormalizationApplication"),
    true,
    "schema should define the application record for the active normalized layer",
  );
});

test("workspace route exposes raw and simulated distributions for one source without mutating raw records", () => {
  const source = read("src/app/api/score-normalization/workspace/route.ts");

  assert.equal(
    source.includes("rawDistribution"),
    true,
    "workspace route should return the raw distribution view",
  );
  assert.equal(
    source.includes("simulatedDistribution"),
    true,
    "workspace route should return the simulated distribution view",
  );
  assert.equal(
    source.includes("application"),
    true,
    "workspace route should include the application snapshot payload",
  );
});
