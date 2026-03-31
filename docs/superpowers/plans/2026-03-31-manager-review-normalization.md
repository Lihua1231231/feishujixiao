# Manager Review Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new `绩效初评分布校准` page that analyzes manager-review score bias, simulates department-level forced distribution, and lets authorized users apply or roll back the simulated result without changing raw manager-review records.

**Architecture:** Add a separate normalization layer for manager-review data only. Keep raw `SupervisorEval` rows untouched, generate reviewer-normalized and department-forced snapshots into dedicated tables, and expose a new page plus apply/revert controls that feed existing calibration/admin statistics from the active simulated layer.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma, Tailwind CSS, node:test, ESLint

---

## File Structure

### Existing files to modify

- `prisma/schema.prisma`
  Add manager-review normalization snapshot, entry, and application models.
- `src/components/nav.tsx`
  Add the new page link for authorized viewers.
- `src/app/(main)/layout.tsx`
  Ensure the new route inherits the main authenticated shell.
- `src/lib/final-review.ts`
  Allow calibration distributions/ranking/reference hints to read the active manager-review normalized layer.
- `src/app/api/final-review/workspace/route.ts`
  Pass through the active normalized calibration inputs so the existing calibration page stays aligned after apply/revert.
- `src/app/api/admin/verify/route.ts`
  Use the active normalized layer when building affected ranking/distribution stats.
- `src/app/api/admin/verify/export/route.ts`
  Export raw vs normalized manager-review fields side by side when the normalized layer exists.
- `scripts/test-final-review-backend.mjs`
  Lock the calibration payload integration with the active normalized layer.
- `scripts/test-final-review-ui.mjs`
  Lock the navigation entry and calibration labels that depend on the new normalized state.

### New files to create

- `src/lib/manager-review-normalization.ts`
  Core algorithm helpers: reviewer-bias normalization, department forced-distribution mapping, snapshot shaping, and apply/revert helpers.
- `src/lib/manager-review-normalization-permissions.ts`
  Central access checks for the new page and apply/revert actions.
- `src/components/manager-review-normalization/types.ts`
  Shared payload types for the new page.
- `src/components/manager-review-normalization/page-shell.tsx`
  Top-level page shell with summary strip and apply-state banner.
- `src/components/manager-review-normalization/reviewer-bias-board.tsx`
  Reviewer-bias section with raw-vs-normalized comparison.
- `src/components/manager-review-normalization/department-distribution-chart.tsx`
  Three-state department distribution comparison chart.
- `src/components/manager-review-normalization/ranking-change-chart.tsx`
  Bump-chart style ranking comparison for one selected department.
- `src/components/manager-review-normalization/change-preview-table.tsx`
  Expandable person-level before/after change table.
- `src/components/manager-review-normalization/apply-panel.tsx`
  Double-confirm apply and rollback controls.
- `src/app/(main)/manager-review-normalization/page.tsx`
  New page entrypoint that fetches the workspace payload and handles apply/revert.
- `src/app/api/manager-review-normalization/workspace/route.ts`
  Read raw analysis, reviewer-normalized results, department-forced results, and current application status.
- `src/app/api/manager-review-normalization/apply/route.ts`
  Apply a generated manager-review normalization snapshot.
- `src/app/api/manager-review-normalization/revert/route.ts`
  Revert manager-review normalization back to raw-score mode.
- `scripts/test-manager-review-normalization-backend.mjs`
  API/data-layer contract tests for normalization snapshots and apply/revert.
- `scripts/test-manager-review-normalization-ui.mjs`
  UI contract tests for the new page and its key charts/labels.

### Migration / ops files to create

- `prisma/migrations/20260331190000_add_manager_review_normalization_tables/migration.sql`
  Add the new snapshot/application tables.

---

### Task 1: Freeze the new feature contract in tests

**Files:**
- Create: `scripts/test-manager-review-normalization-backend.mjs`
- Create: `scripts/test-manager-review-normalization-ui.mjs`
- Modify: `scripts/test-final-review-backend.mjs`
- Modify: `scripts/test-final-review-ui.mjs`

- [ ] **Step 1: Write failing UI-contract tests for the new page, labels, and non-360 scope**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("manager review normalization page exists and is manager-review only", () => {
  const page = read("src/app/(main)/manager-review-normalization/page.tsx");

  assert.equal(
    page.includes("绩效初评分布校准") &&
      !page.includes("360环评分布校准") &&
      !page.includes("360 环评"),
    true,
    "the new page must only describe manager-review normalization",
  );
});

test("normalization page exposes reviewer bias, department distribution, and rollback controls", () => {
  const shell = read("src/components/manager-review-normalization/page-shell.tsx");

  assert.equal(
    shell.includes("评分人尺度校正") &&
      shell.includes("部门强制正态分布模拟") &&
      shell.includes("回退到原始口径"),
    true,
    "the page shell must surface the three required sections",
  );
});
```

- [ ] **Step 2: Write failing backend-contract tests for the manager-review-only normalization layer**

```js
test("schema adds manager-review normalization tables without touching raw supervisor eval rows", () => {
  const schema = read("prisma/schema.prisma");

  assert.equal(
    schema.includes("model ManagerReviewNormalizationSnapshot") &&
      schema.includes("model ManagerReviewNormalizationEntry") &&
      schema.includes("model ManagerReviewNormalizationApplication") &&
      schema.includes("model SupervisorEval"),
    true,
    "the schema must add a separate normalization layer while keeping SupervisorEval intact",
  );
});

test("workspace route exposes raw, reviewer-normalized, and department-normalized results", () => {
  const route = read("src/app/api/manager-review-normalization/workspace/route.ts");

  assert.equal(
    route.includes("rawDistribution") &&
      route.includes("reviewerNormalizedDistribution") &&
      route.includes("departmentNormalizedDistribution"),
    true,
    "workspace payload must include all three result layers",
  );
});

test("final review workspace reads the active manager-review normalization map", () => {
  const source = read("src/lib/final-review.ts");

  assert.equal(
    source.includes("getAppliedManagerReviewNormalizationMap") ||
      source.includes("appliedManagerReviewNormalization"),
    true,
    "final-review payload must have an explicit hook for the active normalized manager-review layer",
  );
});
```

- [ ] **Step 3: Run the red tests and confirm the feature contract is still missing**

Run: `node --test scripts/test-manager-review-normalization-backend.mjs scripts/test-manager-review-normalization-ui.mjs scripts/test-final-review-backend.mjs scripts/test-final-review-ui.mjs`

Expected: FAIL because the new page files, schema models, and normalization integration do not exist yet.

- [ ] **Step 4: Commit the red checkpoint**

```bash
git add scripts/test-manager-review-normalization-backend.mjs scripts/test-manager-review-normalization-ui.mjs scripts/test-final-review-backend.mjs scripts/test-final-review-ui.mjs
git commit -m "test: lock manager review normalization contract"
```

### Task 2: Add the manager-review normalization data layer and algorithms

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260331190000_add_manager_review_normalization_tables/migration.sql`
- Create: `src/lib/manager-review-normalization.ts`
- Test: `scripts/test-manager-review-normalization-backend.mjs`

- [ ] **Step 1: Add Prisma models for manager-review normalization snapshots, entries, and applied state**

```prisma
model ManagerReviewNormalizationSnapshot {
  id               String   @id @default(cuid())
  cycleId          String
  strategy         String   // REVIEWER_BIAS | DEPARTMENT_FORCED
  algorithmVersion String   @default("manager-review-normalization-v1")
  generatedById    String?
  createdAt        DateTime @default(now())
  appliedAt        DateTime?
  revertedAt       DateTime?

  entries          ManagerReviewNormalizationEntry[]

  @@index([cycleId, strategy])
}

model ManagerReviewNormalizationEntry {
  id                        String   @id @default(cuid())
  snapshotId                String
  snapshot                  ManagerReviewNormalizationSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  employeeId                String
  evaluatorId               String?
  department                String   @default("")
  rawScore                  Float
  reviewerNormalizedScore   Float
  departmentNormalizedScore Float
  referenceStars            Int
  rawRank                   Int?
  reviewerNormalizedRank    Int?
  departmentNormalizedRank  Int?
  movement                  String   @default("UNCHANGED")
  createdAt                 DateTime @default(now())

  @@index([snapshotId, employeeId])
  @@index([snapshotId, department])
}

model ManagerReviewNormalizationApplication {
  id                String   @id @default(cuid())
  cycleId           String   @unique
  appliedSnapshotId String?
  appliedById       String?
  status            String   @default("RAW") // RAW | NORMALIZED
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

- [ ] **Step 2: Create the matching migration SQL**

```sql
CREATE TABLE "ManagerReviewNormalizationSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cycleId" TEXT NOT NULL,
  "strategy" TEXT NOT NULL,
  "algorithmVersion" TEXT NOT NULL DEFAULT 'manager-review-normalization-v1',
  "generatedById" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedAt" DATETIME,
  "revertedAt" DATETIME
);

CREATE TABLE "ManagerReviewNormalizationEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "snapshotId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "evaluatorId" TEXT,
  "department" TEXT NOT NULL DEFAULT '',
  "rawScore" REAL NOT NULL,
  "reviewerNormalizedScore" REAL NOT NULL,
  "departmentNormalizedScore" REAL NOT NULL,
  "referenceStars" INTEGER NOT NULL,
  "rawRank" INTEGER,
  "reviewerNormalizedRank" INTEGER,
  "departmentNormalizedRank" INTEGER,
  "movement" TEXT NOT NULL DEFAULT 'UNCHANGED',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagerReviewNormalizationEntry_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "ManagerReviewNormalizationSnapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ManagerReviewNormalizationApplication" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cycleId" TEXT NOT NULL,
  "appliedSnapshotId" TEXT,
  "appliedById" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RAW',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "ManagerReviewNormalizationSnapshot_cycleId_strategy_idx"
  ON "ManagerReviewNormalizationSnapshot"("cycleId", "strategy");
CREATE INDEX "ManagerReviewNormalizationEntry_snapshotId_employeeId_idx"
  ON "ManagerReviewNormalizationEntry"("snapshotId", "employeeId");
CREATE INDEX "ManagerReviewNormalizationEntry_snapshotId_department_idx"
  ON "ManagerReviewNormalizationEntry"("snapshotId", "department");
CREATE UNIQUE INDEX "ManagerReviewNormalizationApplication_cycleId_key"
  ON "ManagerReviewNormalizationApplication"("cycleId");
```

- [ ] **Step 3: Implement the algorithm helpers for reviewer normalization and department forced distribution**

```ts
export type ManagerReviewScoreRow = {
  employeeId: string;
  employeeName: string;
  evaluatorId: string;
  evaluatorName: string;
  department: string;
  rawScore: number;
};

export function mapRankToReferenceStars(rankIndex: number, total: number) {
  const pct = total === 0 ? 0 : (rankIndex + 1) / total;
  if (pct <= 0.05) return 1;
  if (pct <= 0.2) return 2;
  if (pct <= 0.7) return 3;
  if (pct <= 0.9) return 4;
  return 5;
}

export function mapRankToNormalizedScore(rankIndex: number, total: number) {
  const stars = mapRankToReferenceStars(rankIndex, total);
  const bucketPosition = total <= 1 ? 0.5 : rankIndex / Math.max(total - 1, 1);
  const spread = 0.8 - bucketPosition * 0.6;
  return Number((stars + spread).toFixed(1));
}

export function normalizeReviewerScores(rows: ManagerReviewScoreRow[]) {
  const grouped = new Map<string, ManagerReviewScoreRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.evaluatorId) ?? [];
    list.push(row);
    grouped.set(row.evaluatorId, list);
  }

  const result = new Map<string, { normalizedScore: number; referenceStars: number }>();
  for (const list of grouped.values()) {
    const sorted = [...list].sort((a, b) => b.rawScore - a.rawScore);
    sorted.forEach((row, index) => {
      result.set(row.employeeId, {
        normalizedScore: mapRankToNormalizedScore(index, sorted.length),
        referenceStars: mapRankToReferenceStars(index, sorted.length),
      });
    });
  }
  return result;
}

export function normalizeDepartmentScores(
  rows: Array<ManagerReviewScoreRow & { reviewerNormalizedScore: number }>
) {
  const grouped = new Map<string, Array<ManagerReviewScoreRow & { reviewerNormalizedScore: number }>>();
  for (const row of rows) {
    const key = row.department || "未分组";
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const result = new Map<string, { normalizedScore: number; referenceStars: number }>();
  for (const list of grouped.values()) {
    const sorted = [...list].sort((a, b) => b.reviewerNormalizedScore - a.reviewerNormalizedScore);
    sorted.forEach((row, index) => {
      result.set(row.employeeId, {
        normalizedScore: mapRankToNormalizedScore(index, sorted.length),
        referenceStars: mapRankToReferenceStars(index, sorted.length),
      });
    });
  }
  return result;
}
```

- [ ] **Step 4: Run the new backend tests and make sure the data-layer contract passes**

Run: `node --test scripts/test-manager-review-normalization-backend.mjs`

Expected: PASS with the new schema/model/algorithm hooks in place.

- [ ] **Step 5: Commit the data-layer checkpoint**

```bash
git add prisma/schema.prisma prisma/migrations/20260331190000_add_manager_review_normalization_tables/migration.sql src/lib/manager-review-normalization.ts scripts/test-manager-review-normalization-backend.mjs
git commit -m "feat: add manager review normalization data layer"
```

### Task 3: Build the workspace API and permission checks

**Files:**
- Create: `src/lib/manager-review-normalization-permissions.ts`
- Create: `src/app/api/manager-review-normalization/workspace/route.ts`
- Create: `src/app/api/manager-review-normalization/apply/route.ts`
- Create: `src/app/api/manager-review-normalization/revert/route.ts`
- Test: `scripts/test-manager-review-normalization-backend.mjs`

- [ ] **Step 1: Add explicit permission helpers for viewer vs operator**

```ts
import type { SessionUser } from "@/lib/session";

const VIEWER_NAMES = new Set(["吴承霖", "邱翔", "禹聪琪"]);

export function canViewManagerReviewNormalization(user: Pick<SessionUser, "name" | "role">) {
  return user.role === "ADMIN" || VIEWER_NAMES.has(user.name);
}

export function canOperateManagerReviewNormalization(user: Pick<SessionUser, "name" | "role">) {
  return user.role === "ADMIN";
}
```

- [ ] **Step 2: Implement the workspace route to return all three score layers plus selected department details**

```ts
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || !canViewManagerReviewNormalization(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cycle = await getActiveCycle();
  if (!cycle) {
    return NextResponse.json({ error: "No active cycle" }, { status: 404 });
  }

  const department = new URL(request.url).searchParams.get("department") ?? "全部";
  const payload = await buildManagerReviewNormalizationWorkspace(cycle.id, department);
  return NextResponse.json(payload);
}
```

- [ ] **Step 3: Implement apply and revert routes with explicit double-confirm guards**

```ts
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !canOperateManagerReviewNormalization(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  if (body.confirmToken !== "APPLY_MANAGER_REVIEW_NORMALIZATION") {
    return NextResponse.json({ error: "Missing confirmation" }, { status: 400 });
  }

  const cycle = await getActiveCycle();
  if (!cycle) {
    return NextResponse.json({ error: "No active cycle" }, { status: 404 });
  }

  const snapshot = await applyManagerReviewNormalization(cycle.id, user.id);
  return NextResponse.json({ ok: true, snapshotId: snapshot.id });
}
```

```ts
export async function POST() {
  const user = await getSessionUser();
  if (!user || !canOperateManagerReviewNormalization(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cycle = await getActiveCycle();
  if (!cycle) {
    return NextResponse.json({ error: "No active cycle" }, { status: 404 });
  }

  await revertManagerReviewNormalization(cycle.id, user.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run the backend contract tests against the new routes**

Run: `node --test scripts/test-manager-review-normalization-backend.mjs`

Expected: PASS, including permission, workspace, apply, and revert contract checks.

- [ ] **Step 5: Commit the API checkpoint**

```bash
git add src/lib/manager-review-normalization-permissions.ts src/app/api/manager-review-normalization/workspace/route.ts src/app/api/manager-review-normalization/apply/route.ts src/app/api/manager-review-normalization/revert/route.ts scripts/test-manager-review-normalization-backend.mjs
git commit -m "feat: add manager review normalization api"
```

### Task 4: Build the new page and charts

**Files:**
- Create: `src/components/manager-review-normalization/types.ts`
- Create: `src/components/manager-review-normalization/page-shell.tsx`
- Create: `src/components/manager-review-normalization/reviewer-bias-board.tsx`
- Create: `src/components/manager-review-normalization/department-distribution-chart.tsx`
- Create: `src/components/manager-review-normalization/ranking-change-chart.tsx`
- Create: `src/components/manager-review-normalization/change-preview-table.tsx`
- Create: `src/components/manager-review-normalization/apply-panel.tsx`
- Create: `src/app/(main)/manager-review-normalization/page.tsx`
- Modify: `src/components/nav.tsx`
- Test: `scripts/test-manager-review-normalization-ui.mjs`

- [ ] **Step 1: Define the shared payload types used by the page**

```ts
export type NormalizationDistributionBucket = {
  stars: number;
  rawCount: number;
  reviewerNormalizedCount: number;
  departmentNormalizedCount: number;
};

export type RankingChangeRow = {
  employeeId: string;
  employeeName: string;
  department: string;
  rawScore: number;
  reviewerNormalizedScore: number;
  departmentNormalizedScore: number;
  referenceStars: number;
  rawRank: number;
  reviewerNormalizedRank: number;
  departmentNormalizedRank: number;
};

export type ManagerReviewNormalizationWorkspace = {
  activeMode: "RAW" | "NORMALIZED";
  selectedDepartment: string;
  reviewerBiasRows: Array<{
    evaluatorId: string;
    evaluatorName: string;
    reviewCount: number;
    averageRawScore: number;
    averageReviewerNormalizedScore: number;
    biasLabel: "偏高" | "偏低" | "正常";
  }>;
  distribution: NormalizationDistributionBucket[];
  rankingChanges: RankingChangeRow[];
};
```

- [ ] **Step 2: Build the page shell, charts, and apply panel**

```tsx
export function ManagerReviewNormalizationPageShell({
  workspace,
  canOperate,
}: {
  workspace: ManagerReviewNormalizationWorkspace;
  canOperate: boolean;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-stone-200 bg-stone-50 p-6">
        <h1 className="text-2xl font-semibold text-stone-900">绩效初评分布校准</h1>
        <p className="mt-2 text-sm text-stone-600">
          只分析绩效初评，不包含 360 环评。先校正评分人尺度，再做部门强制分布模拟。
        </p>
      </section>

      <ReviewerBiasBoard rows={workspace.reviewerBiasRows} />
      <DepartmentDistributionChart buckets={workspace.distribution} />
      <RankingChangeChart rows={workspace.rankingChanges} />
      <ChangePreviewTable rows={workspace.rankingChanges} />
      <ApplyPanel activeMode={workspace.activeMode} canOperate={canOperate} />
    </div>
  );
}
```

- [ ] **Step 3: Add the new route and navigation entry**

```tsx
export default async function ManagerReviewNormalizationPage() {
  const response = await fetch("/api/manager-review-normalization/workspace", { cache: "no-store" });
  const workspace = await response.json();

  return <ManagerReviewNormalizationPageShell workspace={workspace} canOperate={workspace.canOperate} />;
}
```

```tsx
{
  canAccessManagerReviewNormalization && (
    <Link href="/manager-review-normalization" className={navClassName}>
      绩效初评分布校准
    </Link>
  );
}
```

- [ ] **Step 4: Run the UI tests and confirm the new page contract passes**

Run: `node --test scripts/test-manager-review-normalization-ui.mjs scripts/test-final-review-ui.mjs`

Expected: PASS, including the route, labels, and non-360 wording.

- [ ] **Step 5: Commit the page checkpoint**

```bash
git add src/components/manager-review-normalization/types.ts src/components/manager-review-normalization/page-shell.tsx src/components/manager-review-normalization/reviewer-bias-board.tsx src/components/manager-review-normalization/department-distribution-chart.tsx src/components/manager-review-normalization/ranking-change-chart.tsx src/components/manager-review-normalization/change-preview-table.tsx src/components/manager-review-normalization/apply-panel.tsx src/app/(main)/manager-review-normalization/page.tsx src/components/nav.tsx scripts/test-manager-review-normalization-ui.mjs scripts/test-final-review-ui.mjs
git commit -m "feat: add manager review normalization page"
```

### Task 5: Feed the active normalized layer into calibration and admin views

**Files:**
- Modify: `src/lib/final-review.ts`
- Modify: `src/app/api/final-review/workspace/route.ts`
- Modify: `src/app/api/admin/verify/route.ts`
- Modify: `src/app/api/admin/verify/export/route.ts`
- Test: `scripts/test-final-review-backend.mjs`
- Test: `scripts/test-manager-review-normalization-backend.mjs`

- [ ] **Step 1: Add a helper that returns the active normalized manager-review map**

```ts
export async function getAppliedManagerReviewNormalizationMap(cycleId: string) {
  const application = await prisma.managerReviewNormalizationApplication.findUnique({
    where: { cycleId },
  });
  if (!application || application.status !== "NORMALIZED" || !application.appliedSnapshotId) {
    return new Map<string, { normalizedScore: number; referenceStars: number }>();
  }

  const entries = await prisma.managerReviewNormalizationEntry.findMany({
    where: { snapshotId: application.appliedSnapshotId },
    select: {
      employeeId: true,
      departmentNormalizedScore: true,
      referenceStars: true,
    },
  });

  return new Map(entries.map((entry) => [entry.employeeId, {
    normalizedScore: entry.departmentNormalizedScore,
    referenceStars: entry.referenceStars,
  }]));
}
```

- [ ] **Step 2: Use that map when building calibration reference scores and admin stats**

```ts
const normalizedMap = await getAppliedManagerReviewNormalizationMap(cycle.id);

const referenceScore = normalizedMap.get(employee.id)?.normalizedScore ?? evaluation.weightedScore ?? null;
const referenceStars = normalizedMap.get(employee.id)?.referenceStars
  ?? mapScoreToReferenceStars(referenceScore, config.referenceStarRanges);
```

```ts
const exportRow = {
  name: employee.name,
  rawWeightedScore: evalRecord?.weightedScore ?? "",
  normalizedWeightedScore: normalizedMap.get(employee.id)?.normalizedScore ?? "",
  normalizedReferenceStars: normalizedMap.get(employee.id)?.referenceStars ?? "",
};
```

- [ ] **Step 3: Run the integration tests to verify calibration/admin read the same active layer**

Run: `node --test scripts/test-final-review-backend.mjs scripts/test-manager-review-normalization-backend.mjs`

Expected: PASS, including calibration payload integration and admin export integration.

- [ ] **Step 4: Commit the integration checkpoint**

```bash
git add src/lib/final-review.ts src/app/api/final-review/workspace/route.ts src/app/api/admin/verify/route.ts src/app/api/admin/verify/export/route.ts scripts/test-final-review-backend.mjs scripts/test-manager-review-normalization-backend.mjs
git commit -m "feat: apply manager review normalization to calibration views"
```

### Task 6: Verify the whole feature end to end

**Files:**
- Verify only; no planned file creation

- [ ] **Step 1: Run the focused automated checks**

Run: `node --test scripts/test-manager-review-normalization-backend.mjs scripts/test-manager-review-normalization-ui.mjs scripts/test-final-review-backend.mjs scripts/test-final-review-ui.mjs`

Expected: PASS for all focused normalization and calibration contracts.

- [ ] **Step 2: Run lint on all touched files**

Run: `npx eslint prisma/schema.prisma src/lib/manager-review-normalization.ts src/lib/manager-review-normalization-permissions.ts src/lib/final-review.ts src/components/nav.tsx src/components/manager-review-normalization/*.tsx src/app/(main)/manager-review-normalization/page.tsx src/app/api/manager-review-normalization/*/route.ts src/app/api/final-review/workspace/route.ts src/app/api/admin/verify/route.ts src/app/api/admin/verify/export/route.ts scripts/test-manager-review-normalization-backend.mjs scripts/test-manager-review-normalization-ui.mjs scripts/test-final-review-backend.mjs scripts/test-final-review-ui.mjs`

Expected: PASS with no new warnings in touched files.

- [ ] **Step 3: Run a full production build**

Run: `npm run build`

Expected: PASS and the route list includes `/manager-review-normalization`.

- [ ] **Step 4: Commit the verification checkpoint**

```bash
git add prisma/schema.prisma \
  prisma/migrations/20260331190000_add_manager_review_normalization_tables/migration.sql \
  src/lib/manager-review-normalization.ts \
  src/lib/manager-review-normalization-permissions.ts \
  src/lib/final-review.ts \
  src/components/nav.tsx \
  src/components/manager-review-normalization/types.ts \
  src/components/manager-review-normalization/page-shell.tsx \
  src/components/manager-review-normalization/reviewer-bias-board.tsx \
  src/components/manager-review-normalization/department-distribution-chart.tsx \
  src/components/manager-review-normalization/ranking-change-chart.tsx \
  src/components/manager-review-normalization/change-preview-table.tsx \
  src/components/manager-review-normalization/apply-panel.tsx \
  "src/app/(main)/manager-review-normalization/page.tsx" \
  src/app/api/manager-review-normalization/workspace/route.ts \
  src/app/api/manager-review-normalization/apply/route.ts \
  src/app/api/manager-review-normalization/revert/route.ts \
  src/app/api/final-review/workspace/route.ts \
  src/app/api/admin/verify/route.ts \
  src/app/api/admin/verify/export/route.ts \
  scripts/test-manager-review-normalization-backend.mjs \
  scripts/test-manager-review-normalization-ui.mjs \
  scripts/test-final-review-backend.mjs \
  scripts/test-final-review-ui.mjs
git commit -m "chore: verify manager review normalization feature"
```

---

## Self-Review

### Spec coverage

- “只做绩效初评，不做 360” → Task 1 UI test, Task 2 algorithm/data layer, Task 4 page labels
- “先校正评分人，再按部门做强制分布” → Task 2 algorithms, Task 4 charts
- “保留连续分值 + 参考星级” → Task 2 entry schema and output, Task 4 ranking table
- “应用与回退，不改原始初评” → Task 2 models, Task 3 apply/revert routes, Task 5 integration rules
- “影响校准页和后台统计，不影响原始记录” → Task 5 integration hooks

No spec gap remains.

### Placeholder scan

- Removed generic “add validation” wording; every task includes the concrete files, commands, and code shape needed.
- No “TODO / TBD / implement later / similar to task N” placeholders remain.

### Type consistency

- The plan consistently uses:
  - `ManagerReviewNormalizationSnapshot`
  - `ManagerReviewNormalizationEntry`
  - `ManagerReviewNormalizationApplication`
  - `getAppliedManagerReviewNormalizationMap`
  - `departmentNormalizedScore`
  - `referenceStars`

No naming drift remains across tasks.
