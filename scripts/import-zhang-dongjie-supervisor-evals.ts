import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { buildSupervisorAssignmentMap } from "../src/lib/supervisor-assignments.ts";

export const EVALUATOR_NAME = "张东杰";

export const SCREENSHOT_RESULTS = [
  ["李泽龙", 5],
  ["沈楚城", 5],
  ["许斯荣", 4],
  ["赖永涛", 4],
  ["陈毅强", 4],
  ["曹文跃", 4],
  ["陈家兴", 4],
  ["张福强", 3],
  ["胡毅薇", 3],
  ["严骏", 3],
  ["洪炯腾", 3],
  ["余一铭", 3],
  ["江培章", 3],
  ["薛琳蕊", 3],
  ["陈佳杰", 3],
  ["张建生", 2],
  ["顾元舜", 2],
  ["刘一", 1],
] as const;

type Cycle = {
  id: string;
  name: string;
  status: string;
};

type UserRow = {
  id: string;
  name: string;
  supervisorId: string | null;
  supervisor: { id: string; name: string } | null;
};

type ExistingSupervisorEval = {
  employeeId: string;
  evaluatorId: string;
  evaluatorName: string;
};

type ScreenshotResult = readonly [string, number];

type PlannedRow = {
  employeeId: string;
  employeeName: string;
  stars: number;
  data: ReturnType<typeof createSupervisorEvalPayload>;
};

type SkippedExisting = {
  employeeId: string;
  employeeName: string;
  reason: string;
};

type InvalidTarget = {
  employeeName: string;
  reason: string;
};

type BuildImportPlanArgs = {
  cycle: Cycle;
  evaluatorName: string;
  screenshotResults: readonly ScreenshotResult[];
  users: UserRow[];
  existingSupervisorEvals: ExistingSupervisorEval[];
  now?: Date;
};

export function createPlaceholderComment(stars: number) {
  return `由截图补录导入：原始记录仅包含总星级 ${stars} 星，详细维度评语待补充。`;
}

export function createSupervisorEvalPayload(stars: number, now = new Date()) {
  const comment = createPlaceholderComment(stars);
  return {
    performanceStars: stars,
    performanceComment: comment,
    comprehensiveStars: stars,
    learningStars: stars,
    adaptabilityStars: stars,
    abilityStars: stars,
    abilityComment: comment,
    valuesStars: stars,
    valuesComment: comment,
    candidStars: stars,
    candidComment: comment,
    progressStars: stars,
    progressComment: comment,
    altruismStars: stars,
    altruismComment: comment,
    rootStars: stars,
    rootComment: comment,
    weightedScore: stars,
    status: "SUBMITTED",
    submittedAt: now,
  } as const;
}

export function buildImportPlan({
  cycle,
  evaluatorName,
  screenshotResults,
  users,
  existingSupervisorEvals,
  now = new Date(),
}: BuildImportPlanArgs) {
  const evaluator = users.find((user) => user.name === evaluatorName);
  if (!evaluator) {
    throw new Error(`未找到评估人：${evaluatorName}`);
  }

  if (cycle.status !== "SUPERVISOR_EVAL") {
    throw new Error(`当前周期状态为 ${cycle.status}，不是 SUPERVISOR_EVAL，禁止导入`);
  }

  const assignments = buildSupervisorAssignmentMap(users, existingSupervisorEvals);
  const userByName = new Map(users.map((user) => [user.name, user]));
  const existingKeySet = new Set(
    existingSupervisorEvals.map((item) => `${item.employeeId}::${item.evaluatorId}`),
  );

  const rowsToCreate: PlannedRow[] = [];
  const skippedExisting: SkippedExisting[] = [];
  const invalidTargets: InvalidTarget[] = [];

  for (const [employeeName, stars] of screenshotResults) {
    const employee = userByName.get(employeeName);
    if (!employee) {
      invalidTargets.push({ employeeName, reason: "系统中不存在该员工" });
      continue;
    }

    const assignment = assignments.get(employee.id);
    if (!assignment || !assignment.currentEvaluatorIds.includes(evaluator.id)) {
      invalidTargets.push({
        employeeName,
        reason: "不是张东杰当前有效评估对象",
      });
      continue;
    }

    const existingKey = `${employee.id}::${evaluator.id}`;
    if (existingKeySet.has(existingKey)) {
      skippedExisting.push({
        employeeId: employee.id,
        employeeName,
        reason: "已存在初评记录，按计划跳过",
      });
      continue;
    }

    rowsToCreate.push({
      employeeId: employee.id,
      employeeName,
      stars,
      data: createSupervisorEvalPayload(stars, now),
    });
  }

  return {
    cycle,
    evaluator,
    totalSourceCount: screenshotResults.length,
    rowsToCreate,
    skippedExisting,
    invalidTargets,
  };
}

async function loadContext() {
  const db = getDb();
  const cycleResult = await db.execute(`
    SELECT id, name, status
    FROM ReviewCycle
    WHERE status != 'ARCHIVED'
    ORDER BY createdAt DESC
    LIMIT 1
  `);

  const cycle = cycleResult.rows[0] as unknown as
    | { id: string; name: string; status: string }
    | undefined;

  if (!cycle) {
    throw new Error("未找到当前活动周期");
  }

  const usersResult = await db.execute(`
    SELECT
      u.id,
      u.name,
      u.supervisorId,
      s.id AS supervisorRefId,
      s.name AS supervisorName
    FROM User u
    LEFT JOIN User s ON s.id = u.supervisorId
  `);

  const supervisorEvalResult = await db.execute({
    sql: `
      SELECT
        se.employeeId,
        se.evaluatorId,
        ev.name AS evaluatorName
      FROM SupervisorEval se
      JOIN User ev ON ev.id = se.evaluatorId
      WHERE se.cycleId = ?
    `,
    args: [cycle.id],
  });

  const users: UserRow[] = usersResult.rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    supervisorId: (row.supervisorId as string | null) ?? null,
    supervisor: row.supervisorName
      ? {
          id: row.supervisorRefId as string,
          name: row.supervisorName as string,
        }
      : null,
  }));

  return {
    cycle,
    users,
    existingSupervisorEvals: supervisorEvalResult.rows.map((row) => ({
      employeeId: row.employeeId as string,
      evaluatorId: row.evaluatorId as string,
      evaluatorName: row.evaluatorName as string,
    })),
  };
}

function printSummary(plan: ReturnType<typeof buildImportPlan>, mode: "dry-run" | "apply") {
  console.log(`模式: ${mode}`);
  console.log(`周期: ${plan.cycle.name} (${plan.cycle.status})`);
  console.log(`评估人: ${plan.evaluator.name}`);
  console.log(`截图名单总数: ${plan.totalSourceCount}`);
  console.log(`可创建数: ${plan.rowsToCreate.length}`);
  console.log(`已存在跳过数: ${plan.skippedExisting.length}`);
  console.log(`非法目标数: ${plan.invalidTargets.length}`);

  if (plan.invalidTargets.length > 0) {
    console.log("\n非法目标:");
    for (const item of plan.invalidTargets) {
      console.log(`- ${item.employeeName}: ${item.reason}`);
    }
  }

  if (plan.skippedExisting.length > 0) {
    console.log("\n已存在跳过:");
    for (const item of plan.skippedExisting) {
      console.log(`- ${item.employeeName}: ${item.reason}`);
    }
  }

  if (plan.rowsToCreate.length > 0) {
    console.log("\n将创建:");
    for (const item of plan.rowsToCreate) {
      console.log(`- ${item.employeeName}: ${item.stars}星`);
    }
  }
}

async function applyPlan(plan: ReturnType<typeof buildImportPlan>) {
  const db = getDb();
  if (plan.invalidTargets.length > 0) {
    throw new Error("存在非法目标，已停止写入");
  }

  if (plan.rowsToCreate.length === 0) {
    console.log("没有需要创建的记录。");
    return;
  }

  for (const item of plan.rowsToCreate) {
    const id = `cuid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const submittedAt = item.data.submittedAt.toISOString();
    await db.execute({
      sql: `
        INSERT INTO SupervisorEval (
          id, cycleId, evaluatorId, employeeId,
          performanceStars, performanceComment,
          abilityStars, abilityComment,
          comprehensiveStars, learningStars, adaptabilityStars,
          valuesStars, valuesComment,
          candidStars, candidComment,
          progressStars, progressComment,
          altruismStars, altruismComment,
          rootStars, rootComment,
          weightedScore, status, submittedAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        plan.cycle.id,
        plan.evaluator.id,
        item.employeeId,
        item.data.performanceStars,
        item.data.performanceComment,
        item.data.abilityStars,
        item.data.abilityComment,
        item.data.comprehensiveStars,
        item.data.learningStars,
        item.data.adaptabilityStars,
        item.data.valuesStars,
        item.data.valuesComment,
        item.data.candidStars,
        item.data.candidComment,
        item.data.progressStars,
        item.data.progressComment,
        item.data.altruismStars,
        item.data.altruismComment,
        item.data.rootStars,
        item.data.rootComment,
        item.data.weightedScore,
        item.data.status,
        submittedAt,
        submittedAt,
        submittedAt,
      ],
    });
  }

  console.log(`已创建 ${plan.rowsToCreate.length} 条初评记录。`);
}

function getDb() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error("缺少 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN，无法连接真实库");
  }

  return createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

export async function main(argv = process.argv.slice(2)) {
  const mode: "dry-run" | "apply" = argv.includes("--apply") ? "apply" : "dry-run";
  const context = await loadContext();
  const plan = buildImportPlan({
    cycle: context.cycle,
    evaluatorName: EVALUATOR_NAME,
    screenshotResults: SCREENSHOT_RESULTS,
    users: context.users,
    existingSupervisorEvals: context.existingSupervisorEvals,
  });

  printSummary(plan, mode);

  if (mode === "dry-run") {
    return;
  }

  await applyPlan(plan);
}

const isMainModule =
  Boolean(process.argv[1]) &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
