# Calibration Cockpit UX Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the final-review cockpit so it reads like a normal绩效终评系统：limited process exposure, searchable roster-based selection, fixed default employee review scope, clearer charts, clearer admin configuration, and a fix for the stuck self-eval preview.

**Architecture:** Keep the existing three-tab final-review workspace and mutation routes, but introduce one new config field for the ordinary employee review roster, tighten the data layer so it returns role-aware visibility flags and a filtered employee set, and replace the current select-heavy UI with search-driven roster components. The admin config screen becomes a member-management surface instead of four native multi-select boxes, while the employee/leader cockpits shift from “show everything” to “show summary first, details by permission.”

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma, Tailwind CSS, node:test, ESLint

---

## File Structure

### Existing files to modify

- `prisma/schema.prisma`
  Add a dedicated config field for the ordinary employee final-review roster.
- `src/lib/final-review.ts`
  Filter the employee scope, expose role-aware visibility flags, and reshape summary-vs-detail data for both employee and leader tabs.
- `src/app/api/admin/final-review-config/route.ts`
  Read/write the new employee roster config field and expose the people list needed by the search-add admin UI.
- `src/app/(main)/admin/page.tsx`
  Replace the native multi-select boxes with searchable add/remove roster cards.
- `src/app/(main)/calibration/page.tsx`
  Keep it as the data/mutation container, but wire in the new roster-driven selection and detail gating.
- `src/components/final-review/types.ts`
  Extend the shared workspace payload types with roster visibility and summary-only/detail-only fields.
- `src/components/final-review/principles-tab.tsx`
  Simplify the wording and supporting chart framing so it reads as a briefing page.
- `src/components/final-review/employee-cockpit.tsx`
  Replace any select-style navigation with a searchable roster rail and cleaner priority queues.
- `src/components/final-review/employee-detail-panel.tsx`
  Show summary-first decision content, hide named opinion detail unless the viewer is allowed, and remove the raw selects.
- `src/components/final-review/leader-cockpit.tsx`
  Use the same roster-rail pattern and reduce process exposure for non-privileged viewers.
- `src/components/final-review/leader-detail-panel.tsx`
  Show summary-first leader comparison and keep detailed dual-review content behind the new visibility rules.
- `src/components/final-review/workspace-view.ts`
  Recompute priority queues and chart summaries for the new filtered employee set and summary-first UI.
- `src/app/(main)/self-eval/page.tsx`
  Fix the supervisor/admin preview loading bug.
- `scripts/test-final-review-ui.mjs`
  Lock the revised cockpit and admin-config UI contract.
- `scripts/test-final-review-backend.mjs`
  Lock the roster filtering, visibility gating, and config payload behavior.

### New files to create

- `src/lib/final-review-defaults.ts`
  Store the default 54-person ordinary employee final-review roster and helper functions that map names to user IDs.
- `src/components/final-review/roster-search-list.tsx`
  Shared searchable list used for cockpit selection rails.
- `src/components/final-review/member-roster-card.tsx`
  Shared admin config picker used for “search add / remove” member management.

### Migration / ops files to create or modify

- `prisma/migrations/20260328093000_add_employee_subject_roster_to_final_review_config/migration.sql`
  Persist the new config field.
- `scripts/migrate-prod.ts`
  If this script already manages production schema upgrades, include the new field migration in the documented production path.

---

### Task 1: Freeze the revised UX and visibility contract in tests

**Files:**
- Modify: `scripts/test-final-review-ui.mjs`
- Modify: `scripts/test-final-review-backend.mjs`

- [ ] **Step 1: Add failing UI tests for summary-first visibility and roster-based selection**

```js
test("employee cockpit uses a searchable roster rail instead of select controls", () => {
  const cockpit = read("src/components/final-review/employee-cockpit.tsx");
  const detail = read("src/components/final-review/employee-detail-panel.tsx");

  assert.equal(
    cockpit.includes("搜索员工") && cockpit.includes("待拍板") && cockpit.includes("有分歧"),
    true,
    "employee cockpit should expose a searchable roster rail and queue-first navigation",
  );
  assert.equal(
    detail.includes("canViewOpinionDetails") && detail.includes("具名意见"),
    true,
    "employee detail panel should explicitly gate named process detail by visibility",
  );
  assert.equal(
    detail.includes("<select"),
    false,
    "employee detail panel should stop using raw select controls for decisions",
  );
});

test("admin final review config uses search-add member cards instead of native multi-select lists", () => {
  const admin = read("src/app/(main)/admin/page.tsx");

  assert.equal(
    admin.includes("搜索添加成员") && admin.includes("已选成员") && admin.includes("移除"),
    true,
    "admin final review config should read like member management, not a browser multi-select",
  );
  assert.equal(
    admin.includes("multiple"),
    false,
    "admin final review config should no longer rely on native multi-select boxes",
  );
});
```

- [ ] **Step 2: Add failing backend tests for the default 54-person roster and detail visibility gating**

```js
test("final review config includes a dedicated ordinary employee roster field", () => {
  const schema = read("prisma/schema.prisma");
  const route = read("src/app/api/admin/final-review-config/route.ts");

  assert.equal(
    schema.includes("employeeSubjectUserIds"),
    true,
    "final review config needs a dedicated ordinary employee roster field",
  );
  assert.equal(
    route.includes("employeeSubjectUserIds"),
    true,
    "admin final review config API should read and write the employee roster field",
  );
});

test("workspace builder filters ordinary employees to the configured employee roster and emits visibility flags", () => {
  const source = read("src/lib/final-review.ts");

  assert.equal(
    source.includes("employeeSubjectUserIds"),
    true,
    "workspace builder should filter ordinary employees by the configured employee roster",
  );
  assert.equal(
    source.includes("canViewOpinionDetails") && source.includes("canViewLeaderEvaluationDetails"),
    true,
    "workspace rows should include explicit visibility flags instead of forcing the UI to guess",
  );
});
```

- [ ] **Step 3: Run both test files to confirm the revised UX contract is red**

Run: `node --test scripts/test-final-review-ui.mjs scripts/test-final-review-backend.mjs`

Expected: FAIL with missing symbols such as `employeeSubjectUserIds`, `搜索添加成员`, `processDetailsVisible`, or the absence of the new visibility flags.

- [ ] **Step 4: Commit the red checkpoint**

```bash
git add scripts/test-final-review-ui.mjs scripts/test-final-review-backend.mjs
git commit -m "test: lock calibration cockpit ux revision contract"
```

### Task 2: Add a dedicated ordinary employee review roster to final-review config

**Files:**
- Create: `src/lib/final-review-defaults.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260328093000_add_employee_subject_roster_to_final_review_config/migration.sql`
- Modify: `src/app/api/admin/final-review-config/route.ts`
- Test: `scripts/test-final-review-backend.mjs`

- [ ] **Step 1: Create a default-roster helper with the 54 fixed names**

```ts
export const DEFAULT_EMPLOYEE_FINAL_REVIEW_NAMES = [
  "李晓霞",
  "鲍建伟",
  "郑文文",
  "赵奇卓",
  "宓鸿宇",
  "曹越",
  "曹铭哲",
  "欧阳伊希",
  "窦雪茹",
  "陈毅强",
  "薛琳蕊",
  "陈佳杰",
  "刘一",
  "张福强",
  "杨倩仪",
  "王煦晖",
  "莫颖儿",
  "吕鸿",
  "冉晨宇",
  "张志权",
  "赖永涛",
  "江培章",
  "陈家兴",
  "严骏",
  "洪炯腾",
  "沈楚城",
  "张建生",
  "符永涛",
  "戴智斌",
  "马莘权",
  "徐宗泽",
  "龙辰",
  "胡毅薇",
  "许斯荣",
  "余一铭",
  "曹文跃",
  "李泽龙",
  "禹聪琪",
  "陈琼",
  "李娟娟",
  "刘瑞峰",
  "李斌琦",
  "林义章",
  "唐昊鸣",
  "王金淋",
  "洪思睿",
  "叶荣金",
  "郭雨明",
  "邹玙璠",
  "杨偲妤",
  "李红军",
  "刘源源",
  "顾元舜",
  "郝锦",
] as const;

export function resolveDefaultEmployeeSubjectIds(users: Array<{ id: string; name: string }>) {
  const wanted = new Set(DEFAULT_EMPLOYEE_FINAL_REVIEW_NAMES);
  return users.filter((user) => wanted.has(user.name)).map((user) => user.id);
}
```

- [ ] **Step 2: Add the new config field to Prisma**

```prisma
model FinalReviewConfig {
  id                     String   @id @default(cuid())
  cycleId                String   @unique
  cycle                  ReviewCycle @relation(fields: [cycleId], references: [id])
  accessUserIds          String   @default("[]")
  finalizerUserIds       String   @default("[]")
  leaderEvaluatorUserIds String   @default("[]")
  leaderSubjectUserIds   String   @default("[]")
  employeeSubjectUserIds String   @default("[]")
  referenceStarRanges    String   @default("[]")
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
}
```

- [ ] **Step 3: Add the SQL migration**

```sql
ALTER TABLE "FinalReviewConfig"
ADD COLUMN "employeeSubjectUserIds" TEXT NOT NULL DEFAULT '[]';
```

- [ ] **Step 4: Update the config API so new cycles auto-seed the ordinary employee roster**

```ts
const employeeSubjectUserIds = parseJsonIds(config.employeeSubjectUserIds).length
  ? parseJsonIds(config.employeeSubjectUserIds)
  : resolveDefaultEmployeeSubjectIds(users);

return NextResponse.json({
  cycleId,
  accessUserIds: parseJsonIds(config.accessUserIds),
  finalizerUserIds: parseJsonIds(config.finalizerUserIds),
  leaderEvaluatorUserIds: parseJsonIds(config.leaderEvaluatorUserIds),
  leaderSubjectUserIds: parseJsonIds(config.leaderSubjectUserIds),
  employeeSubjectUserIds,
  referenceStarRanges: parseReferenceStarRanges(config.referenceStarRanges),
  users,
});
```

- [ ] **Step 5: Run the backend test file to verify the roster field now exists**

Run: `node --test scripts/test-final-review-backend.mjs`

Expected: PASS for the new config-field assertions; older tests may still fail until later tasks land.

- [ ] **Step 6: Commit the roster-model checkpoint**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/final-review-defaults.ts src/app/api/admin/final-review-config/route.ts scripts/test-final-review-backend.mjs
git commit -m "feat: add employee final review roster config"
```

### Task 3: Reshape the final-review workspace for filtered employee scope and detail visibility

**Files:**
- Modify: `src/lib/final-review.ts`
- Modify: `src/components/final-review/types.ts`
- Modify: `src/components/final-review/workspace-view.ts`
- Test: `scripts/test-final-review-backend.mjs`

- [ ] **Step 1: Extend shared types with summary/detail visibility and roster context**

```ts
export type EmployeeRow = {
  id: string;
  name: string;
  department: string;
  jobTitle: string | null;
  weightedScore: number | null;
  referenceStars: number | null;
  officialStars: number | null;
  officialReason: string;
  finalizable: boolean;
  canViewOpinionDetails: boolean;
  summaryStats: {
    handledCount: number;
    totalReviewerCount: number;
    pendingCount: number;
    overrideCount: number;
  };
  opinions: EmployeeOpinion[];
  opinionSummary: Array<{
    label: string;
    count: number;
  }>;
  peerAverage: number | null;
  selfEvalStatus: string | null;
  supervisorCommentSummary: string;
};

export type LeaderRow = {
  id: string;
  name: string;
  department: string;
  jobTitle: string | null;
  officialStars: number | null;
  officialReason: string;
  finalizable: boolean;
  canViewLeaderEvaluationDetails: boolean;
  bothSubmitted: boolean;
  evaluations: LeaderEvaluation[];
};
```

- [ ] **Step 2: Filter ordinary employees by the configured employee roster**

```ts
const employeeSubjectIds = new Set(
  parseJsonIds(config.employeeSubjectUserIds).length
    ? parseJsonIds(config.employeeSubjectUserIds)
    : resolveDefaultEmployeeSubjectIds(reviewUsers),
);

const employeeUsers = reviewUsers.filter((item) =>
  employeeSubjectIds.has(item.id) && !leaderSubjectIds.has(item.id),
);
```

- [ ] **Step 3: Gate detail visibility in the workspace builder**

```ts
const canViewOpinionDetails = user.role === "ADMIN" || config.finalizerUserIds.includes(user.id);
const canViewLeaderEvaluationDetails =
  user.role === "ADMIN"
  || config.finalizerUserIds.includes(user.id)
  || config.leaderEvaluatorUserIds.includes(user.id);

const opinionCards = config.accessUserIds.map((reviewerId) => {
  const reviewer = usersById.get(reviewerId);
  const opinion = employeeOpinions.find((item) => item.reviewerId === reviewerId);

  return {
    reviewerId,
    reviewerName: canViewOpinionDetails ? reviewer?.name || "未配置" : "终评相关人",
    decision: opinion?.decision || "PENDING",
    decisionLabel: pickOpinionStatusMeta(opinion?.decision || "PENDING").label,
    suggestedStars: canViewOpinionDetails ? opinion?.suggestedStars ?? referenceStars : null,
    reason: canViewOpinionDetails ? opinion?.reason || "" : "",
    isMine: reviewerId === user.id,
    updatedAt: opinion?.updatedAt?.toISOString() || null,
  };
});
```

- [ ] **Step 4: Keep chart and queue helpers aligned with the filtered roster**

```ts
export function buildEmployeePriorityCards(rows: EmployeeRow[]) {
  const pending = rows.filter((row) => row.officialStars == null);
  const disagreement = rows.filter((row) => row.summaryStats.overrideCount > 0);
  const highBandPending = rows.filter((row) => row.weightedScore != null && row.weightedScore >= 4 && row.officialStars == null);

  return [
    { key: "pending", title: "待拍板", rows: pending },
    { key: "disagreement", title: "有分歧", rows: disagreement },
    { key: "high-band", title: "高分带未定", rows: highBandPending },
  ];
}
```

- [ ] **Step 5: Re-run the backend tests to verify filtering and visibility pass**

Run: `node --test scripts/test-final-review-backend.mjs`

Expected: PASS for the new roster-filter and visibility assertions.

- [ ] **Step 6: Commit the workspace-shaping checkpoint**

```bash
git add src/lib/final-review.ts src/components/final-review/types.ts src/components/final-review/workspace-view.ts scripts/test-final-review-backend.mjs
git commit -m "feat: filter final review workspace by roster and visibility"
```

### Task 4: Replace select-heavy cockpit interaction with searchable roster rails and summary-first detail panels

**Files:**
- Create: `src/components/final-review/roster-search-list.tsx`
- Modify: `src/app/(main)/calibration/page.tsx`
- Modify: `src/components/final-review/employee-cockpit.tsx`
- Modify: `src/components/final-review/employee-detail-panel.tsx`
- Modify: `src/components/final-review/leader-cockpit.tsx`
- Modify: `src/components/final-review/leader-detail-panel.tsx`
- Modify: `src/components/final-review/principles-tab.tsx`
- Test: `scripts/test-final-review-ui.mjs`

- [ ] **Step 1: Add a failing UI test for searchable roster rails and summary-first panels**

```js
test("leader cockpit also uses a searchable roster rail and hides detailed dual-review content by default", () => {
  const cockpit = read("src/components/final-review/leader-cockpit.tsx");
  const detail = read("src/components/final-review/leader-detail-panel.tsx");

  assert.equal(
    cockpit.includes("搜索主管") && cockpit.includes("双人提交进度"),
    true,
    "leader cockpit should switch to searchable roster navigation",
  );
  assert.equal(
    detail.includes("canViewLeaderEvaluationDetails"),
    true,
    "leader detail panel should explicitly gate detailed dual-review content by permission",
  );
  assert.equal(
    detail.includes("<select"),
    false,
    "leader detail panel should stop using raw select controls for final confirmation",
  );
});
```

- [ ] **Step 2: Create the shared searchable roster component**

```tsx
type RosterSearchListProps = {
  searchPlaceholder: string;
  emptyText: string;
  selectedId: string | null;
  items: Array<{
    id: string;
    name: string;
    meta: string;
    status: string;
    tone?: "default" | "outline" | "destructive";
  }>;
  onSelect: (id: string) => void;
};

export function RosterSearchList({
  searchPlaceholder,
  emptyText,
  selectedId,
  items,
  onSelect,
}: RosterSearchListProps) {
  const [query, setQuery] = useState("");
  const visibleItems = items.filter((item) => `${item.name} ${item.meta}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm"
      />
      <div className="space-y-2">
        {visibleItems.length === 0 ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null}
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left",
              item.id === selectedId ? "border-primary bg-primary/[0.04]" : "border-border/60 bg-background",
            )}
          >
            <div>
              <p className="text-sm font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.meta}</p>
            </div>
            <Badge variant={item.tone || "outline"}>{item.status}</Badge>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Refactor employee and leader cockpit left rails to use the new roster component**

```tsx
<RosterSearchList
  searchPlaceholder="搜索员工"
  emptyText="没有匹配的员工"
  selectedId={selectedEmployeeId}
  items={employees.map((employee) => ({
    id: employee.id,
    name: employee.name,
    meta: `${employee.department}${employee.jobTitle ? ` · ${employee.jobTitle}` : ""}`,
    status: employee.officialStars == null ? "待拍板" : employee.summaryStats.overrideCount > 0 ? "有分歧" : "已拍板",
    tone: employee.officialStars == null ? "outline" : employee.summaryStats.overrideCount > 0 ? "destructive" : "default",
  }))}
  onSelect={onSelectEmployee}
/>
```

- [ ] **Step 4: Refactor detail panels to summary-first cards and button groups**

```tsx
<div className="grid gap-2 sm:grid-cols-5">
  {[1, 2, 3, 4, 5].map((stars) => (
    <Button
      key={stars}
      type="button"
      variant={confirmForm?.officialStars === stars ? "default" : "outline"}
      onClick={() => onConfirmChange({ officialStars: stars })}
    >
      {stars}星
    </Button>
  ))}
</div>

{employee.canViewOpinionDetails ? (
  <section>
    <h4 className="text-sm font-semibold">具名意见</h4>
    {employee.opinions.map((opinion) => (
      <OpinionCard key={opinion.reviewerId} opinion={opinion} />
    ))}
  </section>
) : (
  <section>
    <h4 className="text-sm font-semibold">意见汇总</h4>
    <p className="text-sm text-muted-foreground">
      已处理 {employee.summaryStats.handledCount}/{employee.summaryStats.totalReviewerCount}，其中改星 {employee.summaryStats.overrideCount} 人。
    </p>
  </section>
)}
```

- [ ] **Step 5: Simplify the principles tab copy so it reads like a briefing page**

```tsx
<SectionHeading
  eyebrow="原则"
  title="这轮终评先看分布，再看重点，再做拍板"
  description="默认先看公司整体分布、当前风险和优先处理对象，具名过程信息只在需要时展开。"
/>
```

- [ ] **Step 6: Run the UI tests to verify the new cockpit contract is green**

Run: `node --test scripts/test-final-review-ui.mjs`

Expected: PASS for the searchable-roster and detail-visibility assertions.

- [ ] **Step 7: Commit the cockpit UX checkpoint**

```bash
git add src/app/(main)/calibration/page.tsx src/components/final-review/principles-tab.tsx src/components/final-review/employee-cockpit.tsx src/components/final-review/employee-detail-panel.tsx src/components/final-review/leader-cockpit.tsx src/components/final-review/leader-detail-panel.tsx src/components/final-review/roster-search-list.tsx scripts/test-final-review-ui.mjs
git commit -m "feat: redesign final review cockpit interaction"
```

### Task 5: Rebuild the admin final-review config screen as search-add/remove member management

**Files:**
- Create: `src/components/final-review/member-roster-card.tsx`
- Modify: `src/app/(main)/admin/page.tsx`
- Modify: `scripts/test-final-review-ui.mjs`

- [ ] **Step 1: Create a reusable admin member-roster card**

```tsx
type MemberRosterCardProps = {
  title: string;
  description: string;
  members: Array<{ id: string; name: string; department: string; role: string }>;
  allUsers: Array<{ id: string; name: string; department: string; role: string }>;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
};

export function MemberRosterCard({
  title,
  description,
  members,
  allUsers,
  onAdd,
  onRemove,
}: MemberRosterCardProps) {
  const [query, setQuery] = useState("");
  const memberIds = new Set(members.map((member) => member.id));
  const candidates = allUsers.filter((user) =>
    !memberIds.has(user.id) && `${user.name} ${user.department} ${user.role}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}（{members.length}人）</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索添加成员"
          className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm"
        />
        {candidates.slice(0, 8).map((user) => (
          <button key={user.id} type="button" onClick={() => onAdd(user.id)} className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left">
            <span>{user.name} · {user.department || "未分配部门"} · {user.role}</span>
            <span className="text-sm text-primary">添加</span>
          </button>
        ))}
        <div className="flex flex-wrap gap-2">
          {members.map((member) => (
            <button key={member.id} type="button" onClick={() => onRemove(member.id)} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
              <span>{member.name}</span>
              <span className="text-muted-foreground">{member.department || "未分配部门"}</span>
              <span className="text-red-600">移除</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Swap the four native multi-select lists out of the admin page**

```tsx
<MemberRosterCard
  title="普通员工终评名单"
  description="本轮普通员工终评默认按指定名单进入工作台，管理员可搜索添加或删除。"
  members={mapIdsToUsers(finalReviewConfig.employeeSubjectUserIds)}
  allUsers={users}
  onAdd={(id) => updateFinalReviewIds("employeeSubjectUserIds", [...finalReviewConfig.employeeSubjectUserIds, id])}
  onRemove={(id) => updateFinalReviewIds("employeeSubjectUserIds", finalReviewConfig.employeeSubjectUserIds.filter((item) => item !== id))}
/>
```

- [ ] **Step 3: Add overlap hints where the same person appears in multiple groups**

```tsx
const overlapUserIds = new Set(
  finalReviewConfig.finalizerUserIds.filter((id) => finalReviewConfig.accessUserIds.includes(id)),
);

{overlapUserIds.size > 0 ? (
  <p className="text-xs text-muted-foreground">
    提示：{Array.from(overlapUserIds).map((id) => usersById[id]?.name || id).join("、")} 同时在多个终评名单中。
  </p>
) : null}
```

- [ ] **Step 4: Run the UI tests again to verify the config screen no longer relies on multi-select**

Run: `node --test scripts/test-final-review-ui.mjs`

Expected: PASS for the config-screen assertions.

- [ ] **Step 5: Commit the admin-config UX checkpoint**

```bash
git add src/app/(main)/admin/page.tsx src/components/final-review/member-roster-card.tsx scripts/test-final-review-ui.mjs
git commit -m "feat: simplify final review config management"
```

### Task 6: Fix the self-eval preview loading bug and run full verification

**Files:**
- Modify: `src/app/(main)/self-eval/page.tsx`
- Test: `scripts/test-final-review-ui.mjs`

- [ ] **Step 1: Add a failing source-level test for the preview-loading fix**

```js
test("self-eval preview bypasses the loading skeleton for supervisor and admin preview views", () => {
  const page = read("src/app/(main)/self-eval/page.tsx");

  assert.equal(
    page.includes("if (!isPreviewEmployee && loading)"),
    true,
    "self-eval should only show the loading skeleton for real fetches, not supervisor/admin preview mode",
  );
  assert.equal(
    page.includes("const previewData = preview && previewRole ? getData(\"self-eval\") : null"),
    true,
    "self-eval preview content should be derived directly instead of waiting on setState inside an effect",
  );
});
```

- [ ] **Step 2: Update the self-eval page so preview content is derived synchronously**

```tsx
const previewData = preview && previewRole ? getData("self-eval") : null;
const isPreviewEmployee = preview && previewRole === "EMPLOYEE";
const resolvedData = isPreviewEmployee ? (previewData as SelfEvalData) : data;

useEffect(() => {
  if (preview && previewRole) {
    return;
  }

  fetch("/api/admin/cycle")
    .then((r) => r.json())
    .then((cycles: CycleInfo[]) => {
      if (Array.isArray(cycles)) {
        const activeCycle = cycles.find((c) => c.status !== "ARCHIVED");
        setSelfEvalStart(activeCycle?.selfEvalStart ?? null);
        setSelfEvalEnd(activeCycle?.selfEvalEnd ?? null);
      }
    })
    .catch(() => {});

  fetch("/api/self-eval")
    .then((r) => r.json())
    .then((d) => {
      if (d && d.importedContent) {
        setData(d);
      }
    })
    .finally(() => setLoading(false));
}, [preview, previewRole, getData]);

if (!isPreviewEmployee && loading) {
  return <FormPageSkeleton />;
}
```

- [ ] **Step 3: Run the full verification suite**

Run: `node --test scripts/test-*.mjs`
Expected: PASS with all test files green.

Run: `npm run lint -- .`
Expected: exit code 0.

Run: `npm run build`
Expected: exit code 0.

- [ ] **Step 4: Commit the final verification checkpoint**

```bash
git add src/app/(main)/self-eval/page.tsx scripts/test-final-review-ui.mjs
git commit -m "fix: finalize calibration cockpit ux revision"
```

## Self-Review Checklist

- Spec coverage:
  - privacy layering: Tasks 3 and 4
  - default 54-person ordinary employee roster: Tasks 2 and 3
  - searchable selection instead of selects: Tasks 4 and 5
  - admin config redesign: Task 5
  - self-eval preview bug: Task 6
- Placeholder scan:
  - no `TODO`, `TBD`, “implement later”, or missing file paths remain
- Type consistency:
  - `employeeSubjectUserIds`, `canViewOpinionDetails`, and `canViewLeaderEvaluationDetails` are defined once and reused consistently across tasks

## Verification Notes

- Keep the current production behavior of the three-tab cockpit; this plan is a targeted UX correction, not a business-rule rewrite.
- Do not reintroduce raw `<select multiple>` in the admin config screen.
- Do not expose named process detail to viewers who are not finalizers or admins.
- Do not let ordinary employee rows fall back to “all non-leaders” once the new employee roster field exists.
