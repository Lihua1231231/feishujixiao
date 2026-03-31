# Score Normalization Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new “360环评 & 绩效初评分布校准” workspace that compares raw vs forced-distribution results, lets authorized users apply one standardized result set with rollback, and feeds the active standardized view back into calibration and admin reporting without changing any raw review records.

**Architecture:** Keep raw 360 and supervisor-evaluation records unchanged. Add a separate normalization layer that stores generated snapshots and the currently applied snapshot per cycle/source. Build one new analysis page with two tabs (`360环评` / `绩效初评`) backed by a dedicated API, then wire the “currently applied normalized result” into existing calibration distributions and admin verification/export summaries.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma, Tailwind CSS, node:test, ESLint

---

## File Structure

### Existing files to modify

- `prisma/schema.prisma`
  Add normalization snapshot/application models.
- `src/components/nav.tsx`
  Add the new page link for authorized viewers.
- `src/lib/final-review.ts`
  Allow calibration distributions/ranking/reference hints to read the active standardized layer instead of only raw scores.
- `src/app/api/admin/verify/route.ts`
  Use the active standardized layer when building affected ranking/distribution stats.
- `src/app/api/admin/verify/export/route.ts`
  Export normalized-vs-raw related fields after the application state exists.
- `scripts/test-final-review-backend.mjs`
  Lock the calibration payload integration with the active normalized layer.
- `scripts/test-final-review-ui.mjs`
  Lock the new page entry and calibration/admin UI text that depends on the new state.

### New files to create

- `src/lib/score-normalization.ts`
  Core algorithm helpers: raw score extraction, ranking-bucket mapping, snapshot shaping, and application-state helpers.
- `src/lib/score-normalization-permissions.ts`
  Central access checks for the new page and apply/revert actions.
- `src/components/score-normalization/types.ts`
  Shared payload types for the new page.
- `src/components/score-normalization/normalization-shell.tsx`
  Two-tab page shell plus top summary banner.
- `src/components/score-normalization/normalization-overview.tsx`
  Shared raw-vs-simulated distribution cards and warning strip.
- `src/components/score-normalization/rater-bias-table.tsx`
  “Who scores too high/low” table for each source.
- `src/components/score-normalization/distribution-diff-chart.tsx`
  Comparison chart for raw distribution vs simulated distribution.
- `src/components/score-normalization/change-preview-table.tsx`
  “Who moves up/down” detail table.
- `src/components/score-normalization/apply-panel.tsx`
  Double-confirm apply box + rollback controls.
- `src/app/(main)/score-normalization/page.tsx`
  New page entrypoint that fetches the workspace payload and handles apply/revert.
- `src/app/api/score-normalization/workspace/route.ts`
  Read raw analysis, simulated results, and current application status.
- `src/app/api/score-normalization/apply/route.ts`
  Apply a generated snapshot for one source.
- `src/app/api/score-normalization/revert/route.ts`
  Revert one source back to raw-score mode.
- `scripts/test-score-normalization-backend.mjs`
  API/data-layer contract tests for normalization snapshots and apply/revert.
- `scripts/test-score-normalization-ui.mjs`
  UI contract tests for the new page and its key warning/apply labels.

### Migration / ops files to create

- `prisma/migrations/20260331130000_add_score_normalization_tables/migration.sql`
  Add the new snapshot/application tables.

---

### Task 1: Freeze the normalization feature contract in tests

**Files:**
- Create: `scripts/test-score-normalization-backend.mjs`
- Create: `scripts/test-score-normalization-ui.mjs`
- Modify: `scripts/test-final-review-backend.mjs`

- [ ] **Step 1: Write failing UI-contract tests for the new page, tabs, and apply/revert wording**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("score normalization page exposes the two required analysis tabs", () => {
  const page = read("src/app/(main)/score-normalization/page.tsx");

  assert.equal(
    page.includes("360环评分布校准") && page.includes("绩效初评分布校准"),
    true,
    "the new page must expose one tab for peer-review normalization and one tab for supervisor-review normalization",
  );
});

test("score normalization page includes double-confirm apply and rollback copy", () => {
  const shell = read("src/components/score-normalization/apply-panel.tsx");

  assert.equal(
    shell.includes("我已理解这会影响排名和后续校准展示") &&
      shell.includes("应用标准化结果") &&
      shell.includes("回退到原始分"),
    true,
    "the apply panel must make the risky action explicit and keep rollback visible",
  );
});
```

- [ ] **Step 2: Write failing backend-contract tests for raw/simulated/application separation**

```js
test("schema adds a separate normalization snapshot layer instead of overwriting raw reviews", () => {
  const schema = read("prisma/schema.prisma");

  assert.equal(
    schema.includes("model ScoreNormalizationSnapshot") &&
      schema.includes("model ScoreNormalizationEntry") &&
      schema.includes("model ScoreNormalizationApplication"),
    true,
    "the schema must persist snapshots, per-subject results, and applied-state separately from raw reviews",
  );
});

test("workspace route exposes raw and simulated distributions for one source without mutating raw records", () => {
  const route = read("src/app/api/score-normalization/workspace/route.ts");

  assert.equal(
    route.includes("rawDistribution") &&
      route.includes("simulatedDistribution") &&
      route.includes("application"),
    true,
    "workspace payload must include raw distribution, simulated distribution, and active application state",
  );
});

test("calibration payload can read the active normalized layer when present", () => {
  const source = read("src/lib/final-review.ts");

  assert.equal(
    source.includes("getAppliedNormalizationMap") || source.includes("appliedNormalization"),
    true,
    "final review payload must have an explicit hook for the active normalization layer",
  );
});
```

- [ ] **Step 3: Run the new red tests and confirm the feature contract is missing**

Run: `node --test scripts/test-score-normalization-backend.mjs scripts/test-score-normalization-ui.mjs scripts/test-final-review-backend.mjs`

Expected: FAIL because the new page files, schema models, and normalization integration do not exist yet.

- [ ] **Step 4: Commit the red checkpoint**

```bash
git add scripts/test-score-normalization-backend.mjs scripts/test-score-normalization-ui.mjs scripts/test-final-review-backend.mjs
git commit -m "test: lock score normalization feature contract"
```

### Task 2: Add the normalization data layer and ranking-bucket algorithm

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260331130000_add_score_normalization_tables/migration.sql`
- Create: `src/lib/score-normalization.ts`
- Test: `scripts/test-score-normalization-backend.mjs`

- [ ] **Step 1: Add Prisma models for snapshots, per-subject results, and applied-state**

```prisma
model ScoreNormalizationSnapshot {
  id               String   @id @default(cuid())
  cycleId          String
  source           String   // PEER_REVIEW | SUPERVISOR_EVAL
  strategy         String   // DEPARTMENT_BUCKET | RATER_BUCKET
  algorithmVersion String   @default("ranking-bucket-v1")
  generatedById    String?
  createdAt        DateTime @default(now())
  appliedAt        DateTime?
  revertedAt       DateTime?

  entries          ScoreNormalizationEntry[]

  @@index([cycleId, source, strategy])
}

model ScoreNormalizationEntry {
  id                  String   @id @default(cuid())
  snapshotId          String
  snapshot            ScoreNormalizationSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  subjectUserId       String
  evaluatorUserId     String?
  department          String   @default("")
  rawScore            Float
  rawStars            Int?
  normalizedScore     Float
  normalizedStars     Int
  rawRank             Int?
  normalizedRank      Int?
  rankDelta           Int?
  movement            String   @default("UNCHANGED")

  @@index([snapshotId, subjectUserId])
  @@index([snapshotId, department])
}

model ScoreNormalizationApplication {
  id                 String   @id @default(cuid())
  cycleId            String
  source             String   // PEER_REVIEW | SUPERVISOR_EVAL
  appliedSnapshotId  String?
  appliedById        String?
  status             String   @default("RAW") // RAW | STANDARDIZED
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@unique([cycleId, source])
}
```

- [ ] **Step 2: Create the migration SQL that adds exactly those tables and indexes**

```sql
CREATE TABLE "ScoreNormalizationSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cycleId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "strategy" TEXT NOT NULL,
  "algorithmVersion" TEXT NOT NULL DEFAULT 'ranking-bucket-v1',
  "generatedById" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedAt" DATETIME,
  "revertedAt" DATETIME
);

CREATE TABLE "ScoreNormalizationEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "snapshotId" TEXT NOT NULL,
  "subjectUserId" TEXT NOT NULL,
  "evaluatorUserId" TEXT,
  "department" TEXT NOT NULL DEFAULT '',
  "rawScore" REAL NOT NULL,
  "rawStars" INTEGER,
  "normalizedScore" REAL NOT NULL,
  "normalizedStars" INTEGER NOT NULL,
  "rawRank" INTEGER,
  "normalizedRank" INTEGER,
  "rankDelta" INTEGER,
  "movement" TEXT NOT NULL DEFAULT 'UNCHANGED',
  CONSTRAINT "ScoreNormalizationEntry_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "ScoreNormalizationSnapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ScoreNormalizationApplication" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cycleId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "appliedSnapshotId" TEXT,
  "appliedById" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RAW',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ScoreNormalizationSnapshot_cycleId_source_strategy_idx"
  ON "ScoreNormalizationSnapshot"("cycleId", "source", "strategy");
CREATE INDEX "ScoreNormalizationEntry_snapshotId_subjectUserId_idx"
  ON "ScoreNormalizationEntry"("snapshotId", "subjectUserId");
CREATE INDEX "ScoreNormalizationEntry_snapshotId_department_idx"
  ON "ScoreNormalizationEntry"("snapshotId", "department");
CREATE UNIQUE INDEX "ScoreNormalizationApplication_cycleId_source_key"
  ON "ScoreNormalizationApplication"("cycleId", "source");
```

- [ ] **Step 3: Implement the ranking-bucket helpers and snapshot builders**

```ts
export type NormalizationSource = "PEER_REVIEW" | "SUPERVISOR_EVAL";
export type NormalizationStrategy = "RATER_BUCKET" | "DEPARTMENT_BUCKET";

export function buildTargetBucketCounts(total: number) {
  const floors = {
    5: Math.floor(total * 0.1),
    4: Math.floor(total * 0.2),
    3: Math.ceil(total * 0.5),
    2: Math.floor(total * 0.15),
    1: Math.floor(total * 0.05),
  };

  let assigned = floors[5] + floors[4] + floors[3] + floors[2] + floors[1];
  while (assigned < total) {
    floors[3] += 1;
    assigned += 1;
  }

  return floors;
}

export function assignStarsByRank<T extends { rawScore: number }>(rows: T[]) {
  const sorted = [...rows].sort((a, b) => b.rawScore - a.rawScore);
  const buckets = buildTargetBucketCounts(sorted.length);
  const starOrder = [5, 4, 3, 2, 1] as const;
  let cursor = 0;

  return starOrder.flatMap((stars) => {
    const count = buckets[stars];
    const chunk = sorted.slice(cursor, cursor + count).map((row, index) => ({
      ...row,
      normalizedStars: stars,
      normalizedRank: cursor + index + 1,
    }));
    cursor += count;
    return chunk;
  });
}
```

- [ ] **Step 4: Run the backend contract tests and keep the data layer green**

Run: `node --test scripts/test-score-normalization-backend.mjs`

Expected: PASS for the schema/model-name and helper assertions, and FAIL only on the workspace-route assertions that are introduced in Task 3.

- [ ] **Step 5: Commit the data-layer checkpoint**

```bash
git add prisma/schema.prisma prisma/migrations/20260331130000_add_score_normalization_tables/migration.sql src/lib/score-normalization.ts scripts/test-score-normalization-backend.mjs
git commit -m "feat: add score normalization data layer"
```

### Task 3: Build the normalization workspace API and permissions

**Files:**
- Create: `src/lib/score-normalization-permissions.ts`
- Create: `src/app/api/score-normalization/workspace/route.ts`
- Test: `scripts/test-score-normalization-backend.mjs`

- [ ] **Step 1: Add a single access helper for the new page and mutation routes**

```ts
import type { SessionUser } from "@/lib/session";

const NORMALIZATION_VIEWER_NAMES = new Set(["吴承霖", "邱翔", "禹聪琪"]);

export function canAccessScoreNormalization(user: Pick<SessionUser, "role" | "name">) {
  return user.role === "ADMIN" || NORMALIZATION_VIEWER_NAMES.has(user.name);
}

export function canApplyScoreNormalization(user: Pick<SessionUser, "role" | "name">) {
  return user.role === "ADMIN" || NORMALIZATION_VIEWER_NAMES.has(user.name);
}
```

- [ ] **Step 2: Implement the workspace route with raw analysis, simulated results, and application state**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, getActiveCycle } from "@/lib/session";
import { canAccessScoreNormalization } from "@/lib/score-normalization-permissions";
import {
  buildPeerReviewNormalizationWorkspace,
  buildSupervisorNormalizationWorkspace,
} from "@/lib/score-normalization";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!canAccessScoreNormalization(user)) {
    return NextResponse.json({ error: "无权查看分布校准" }, { status: 403 });
  }

  const cycle = await getActiveCycle();
  if (!cycle) return NextResponse.json({ error: "当前无活动周期" }, { status: 404 });

  const source = new URL(request.url).searchParams.get("source") === "SUPERVISOR_EVAL"
    ? "SUPERVISOR_EVAL"
    : "PEER_REVIEW";

  const payload = source === "PEER_REVIEW"
    ? await buildPeerReviewNormalizationWorkspace(prisma, cycle.id)
    : await buildSupervisorNormalizationWorkspace(prisma, cycle.id);

  return NextResponse.json({
    cycle: { id: cycle.id, name: cycle.name },
    source,
    ...payload,
  });
}
```

- [ ] **Step 3: Cover the route shape in tests**

```js
test("workspace route returns raw and simulated sections plus application state", () => {
  const route = read("src/app/api/score-normalization/workspace/route.ts");

  assert.equal(
    route.includes("rawDistribution") &&
      route.includes("simulatedDistribution") &&
      route.includes("application"),
    true,
    "workspace route must send raw analysis, simulated results, and current application status together",
  );
});
```

- [ ] **Step 4: Run the backend tests again**

Run: `node --test scripts/test-score-normalization-backend.mjs`

Expected: PASS for permissions and workspace payload shape, while apply/revert-specific assertions remain red until Task 5.

- [ ] **Step 5: Commit the workspace API checkpoint**

```bash
git add src/lib/score-normalization-permissions.ts src/app/api/score-normalization/workspace/route.ts scripts/test-score-normalization-backend.mjs
git commit -m "feat: add score normalization workspace api"
```

### Task 4: Build the new analysis page and cockpit components

**Files:**
- Create: `src/components/score-normalization/types.ts`
- Create: `src/components/score-normalization/normalization-shell.tsx`
- Create: `src/components/score-normalization/normalization-overview.tsx`
- Create: `src/components/score-normalization/rater-bias-table.tsx`
- Create: `src/components/score-normalization/distribution-diff-chart.tsx`
- Create: `src/components/score-normalization/change-preview-table.tsx`
- Create: `src/components/score-normalization/apply-panel.tsx`
- Create: `src/app/(main)/score-normalization/page.tsx`
- Modify: `src/components/nav.tsx`
- Test: `scripts/test-score-normalization-ui.mjs`

- [ ] **Step 1: Define the shared payload types so the page and components use the same contract**

```ts
export type NormalizationWorkspacePayload = {
  cycle: { id: string; name: string };
  source: "PEER_REVIEW" | "SUPERVISOR_EVAL";
  application: {
    status: "RAW" | "STANDARDIZED";
    strategy: "DEPARTMENT_BUCKET";
    appliedAt: string | null;
  };
  summary: {
    totalSubjects: number;
    abnormalRaterCount: number;
    skewedDepartmentCount: number;
  };
  rawDistribution: Array<{ stars: number; count: number; pct: number }>;
  simulatedDistribution: Array<{ stars: number; count: number; pct: number }>;
  raterBiasRows: Array<{ raterName: string; average: number; deltaFromOverall: number; tendency: string }>;
  movementRows: Array<{ subjectName: string; department: string; rawStars: number | null; normalizedStars: number; movement: string }>;
};
```

- [ ] **Step 2: Build the page shell with two tabs and a top application banner**

```tsx
<Tabs defaultValue="PEER_REVIEW" className="space-y-6">
  <TabsList>
    <TabsTrigger value="PEER_REVIEW">360环评分布校准</TabsTrigger>
    <TabsTrigger value="SUPERVISOR_EVAL">绩效初评分布校准</TabsTrigger>
  </TabsList>

  <NormalizationShell
    title="360环评分布校准"
    description="先看原始分布，再看强制分布模拟结果。原始评价记录不会被覆盖。"
    application={workspace.application}
    summary={workspace.summary}
  />
</Tabs>
```

- [ ] **Step 3: Build the main sections: overview, rater-bias table, simulation diff, movement table, and apply panel**

```tsx
<div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
  <NormalizationOverview
    rawDistribution={workspace.rawDistribution}
    simulatedDistribution={workspace.simulatedDistribution}
    targetRules={TARGET_RULES}
  />
  <RaterBiasTable rows={workspace.raterBiasRows} />
</div>

<div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
  <DistributionDiffChart
    rawDistribution={workspace.rawDistribution}
    simulatedDistribution={workspace.simulatedDistribution}
  />
  <ApplyPanel
    application={workspace.application}
    source={workspace.source}
    onApply={applyNormalization}
    onRevert={revertNormalization}
  />
</div>

<ChangePreviewTable rows={workspace.movementRows} />
```

- [ ] **Step 4: Add the navigation entry so authorized users can reach the page**

```tsx
{canAccessScoreNormalization && (
  <NavItem href="/score-normalization" label="分布校准分析" icon={BarChart3} />
)}
```

- [ ] **Step 5: Run the UI contract tests**

Run: `node --test scripts/test-score-normalization-ui.mjs`

Expected: PASS for the page entry, tabs, apply text, and rollback copy.

- [ ] **Step 6: Commit the page-shell checkpoint**

```bash
git add src/components/score-normalization src/app/(main)/score-normalization/page.tsx src/components/nav.tsx scripts/test-score-normalization-ui.mjs
git commit -m "feat: add score normalization analysis page"
```

### Task 5: Add apply/revert routes and persist independent source-level state

**Files:**
- Create: `src/app/api/score-normalization/apply/route.ts`
- Create: `src/app/api/score-normalization/revert/route.ts`
- Modify: `src/lib/score-normalization.ts`
- Test: `scripts/test-score-normalization-backend.mjs`

- [ ] **Step 1: Implement apply so only department-bucket results can become active**

```ts
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!canApplyScoreNormalization(user)) {
    return NextResponse.json({ error: "无权应用标准化结果" }, { status: 403 });
  }

  const { source } = await request.json();
  const cycle = await getActiveCycle();
  const snapshot = await getLatestNormalizationSnapshot({
    cycleId: cycle!.id,
    source,
    strategy: "DEPARTMENT_BUCKET",
  });

  await prisma.scoreNormalizationApplication.upsert({
    where: { cycleId_source: { cycleId: cycle!.id, source } },
    update: {
      status: "STANDARDIZED",
      appliedSnapshotId: snapshot.id,
      appliedById: user.id,
    },
    create: {
      cycleId: cycle!.id,
      source,
      status: "STANDARDIZED",
      appliedSnapshotId: snapshot.id,
      appliedById: user.id,
    },
  });

  return NextResponse.json({ ok: true, snapshotId: snapshot.id });
}
```

- [ ] **Step 2: Implement revert so the snapshot remains stored but the page switches back to raw**

```ts
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!canApplyScoreNormalization(user)) {
    return NextResponse.json({ error: "无权回退标准化结果" }, { status: 403 });
  }

  const { source } = await request.json();
  const cycle = await getActiveCycle();

  await prisma.scoreNormalizationApplication.upsert({
    where: { cycleId_source: { cycleId: cycle!.id, source } },
    update: {
      status: "RAW",
      appliedSnapshotId: null,
      appliedById: user.id,
    },
    create: {
      cycleId: cycle!.id,
      source,
      status: "RAW",
      appliedSnapshotId: null,
      appliedById: user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Extend the backend tests to assert source-level independence**

```js
test("360 and supervisor normalization application states stay independent", () => {
  const schema = read("prisma/schema.prisma");
  const applyRoute = read("src/app/api/score-normalization/apply/route.ts");
  const revertRoute = read("src/app/api/score-normalization/revert/route.ts");

  assert.equal(
    schema.includes("@@unique([cycleId, source])"),
    true,
    "application state must be stored independently for each cycle/source pair",
  );
  assert.equal(
    applyRoute.includes("cycleId_source") && revertRoute.includes("cycleId_source"),
    true,
    "apply and revert should address one source at a time instead of one global switch",
  );
});
```

- [ ] **Step 4: Run the backend tests**

Run: `node --test scripts/test-score-normalization-backend.mjs scripts/test-final-review-backend.mjs`

Expected: PASS for apply/revert state and source-level independence.

- [ ] **Step 5: Commit the apply/revert checkpoint**

```bash
git add src/app/api/score-normalization/apply/route.ts src/app/api/score-normalization/revert/route.ts src/lib/score-normalization.ts scripts/test-score-normalization-backend.mjs
git commit -m "feat: add score normalization apply and revert flow"
```

### Task 6: Feed the active standardized layer back into calibration and admin reporting

**Files:**
- Modify: `src/lib/final-review.ts`
- Modify: `src/app/api/admin/verify/route.ts`
- Modify: `src/app/api/admin/verify/export/route.ts`
- Modify: `scripts/test-final-review-backend.mjs`
- Test: `scripts/test-score-normalization-backend.mjs`

- [ ] **Step 1: Add a lookup helper that maps one active snapshot into subject-level stars/scores**

```ts
export async function getAppliedNormalizationMap(args: {
  cycleId: string;
  source: "PEER_REVIEW" | "SUPERVISOR_EVAL";
}) {
  const application = await prisma.scoreNormalizationApplication.findUnique({
    where: { cycleId_source: { cycleId: args.cycleId, source: args.source } },
  });

  if (!application || application.status !== "STANDARDIZED" || !application.appliedSnapshotId) {
    return new Map<string, { normalizedScore: number; normalizedStars: number }>();
  }

  const entries = await prisma.scoreNormalizationEntry.findMany({
    where: { snapshotId: application.appliedSnapshotId },
  });

  return new Map(entries.map((entry) => [
    entry.subjectUserId,
    { normalizedScore: entry.normalizedScore, normalizedStars: entry.normalizedStars },
  ]));
}
```

- [ ] **Step 2: Teach the calibration payload to prefer the active normalized value for distribution/ranking/reference displays**

```ts
const appliedSupervisorMap = await getAppliedNormalizationMap({
  cycleId: cycle.id,
  source: "SUPERVISOR_EVAL",
});

const normalized = appliedSupervisorMap.get(item.id);
const distributionStars = normalized?.normalizedStars ?? currentStars;
const weightedScore = normalized?.normalizedScore ?? rawWeightedScore;
```

- [ ] **Step 3: Teach admin verify/export to include raw-vs-normalized columns and use the active normalized layer where ranking matters**

```ts
const normalizedSupervisorMap = await getAppliedNormalizationMap({
  cycleId: cycle.id,
  source: "SUPERVISOR_EVAL",
});

return {
  name: user.name,
  rawSupervisorScore: rawScore,
  normalizedSupervisorScore: normalizedSupervisorMap.get(user.id)?.normalizedScore ?? null,
  rawSupervisorStars: rawStars,
  normalizedSupervisorStars: normalizedSupervisorMap.get(user.id)?.normalizedStars ?? null,
};
```

- [ ] **Step 4: Extend the calibration/backend tests to check the integration hook exists**

```js
test("final review payload explicitly prefers applied normalized stars when present", () => {
  const source = read("src/lib/final-review.ts");

  assert.equal(
    source.includes("normalizedStars") && source.includes("normalizedScore"),
    true,
    "calibration payload should expose and consume normalized values when one source has an active applied snapshot",
  );
});
```

- [ ] **Step 5: Run the combined regression tests**

Run: `node --test scripts/test-score-normalization-backend.mjs scripts/test-score-normalization-ui.mjs scripts/test-final-review-backend.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the integration checkpoint**

```bash
git add src/lib/final-review.ts src/app/api/admin/verify/route.ts src/app/api/admin/verify/export/route.ts scripts/test-score-normalization-backend.mjs scripts/test-final-review-backend.mjs
git commit -m "feat: wire score normalization into calibration and admin stats"
```

### Task 7: Run full verification and production-readiness checks

**Files:**
- Modify: `docs/superpowers/specs/2026-03-31-score-normalization-analysis-design.md` (only if behavior drift was discovered)

- [ ] **Step 1: Run the new targeted test files**

Run: `node --test scripts/test-score-normalization-backend.mjs scripts/test-score-normalization-ui.mjs scripts/test-final-review-backend.mjs scripts/test-final-review-ui.mjs`

Expected: PASS.

- [ ] **Step 2: Run lint on all touched files**

Run:

```bash
npx eslint \
  src/lib/score-normalization.ts \
  src/lib/score-normalization-permissions.ts \
  src/lib/final-review.ts \
  src/app/api/score-normalization/workspace/route.ts \
  src/app/api/score-normalization/apply/route.ts \
  src/app/api/score-normalization/revert/route.ts \
  src/app/api/admin/verify/route.ts \
  src/app/api/admin/verify/export/route.ts \
  src/app/(main)/score-normalization/page.tsx \
  src/components/nav.tsx \
  src/components/score-normalization/*.tsx \
  src/components/score-normalization/types.ts \
  scripts/test-score-normalization-backend.mjs \
  scripts/test-score-normalization-ui.mjs
```

Expected: no errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: successful Next.js production build with no new score-normalization failures.

- [ ] **Step 4: Commit the verification checkpoint**

```bash
git add docs/superpowers/specs/2026-03-31-score-normalization-analysis-design.md
git commit -m "chore: verify score normalization implementation"
```
