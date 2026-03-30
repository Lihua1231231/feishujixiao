import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { buildSupervisorAssignmentMap } from "../src/lib/supervisor-assignments.ts";
import {
  computeRoundedAbilityStars,
  computeRoundedValuesStars,
  computeWeightedScoreFromDimensions,
} from "../src/lib/weighted-score.ts";

export const LIZELONG_NAME = "李泽龙";
export const QIUXIANG_NAME = "邱翔";

type Cycle = {
  id: string;
  name: string;
  status: string;
};

type UserRow = {
  id: string;
  name: string;
  department: string;
  role: string;
  supervisorId: string | null;
  supervisor: { id: string; name: string } | null;
};

type ExistingSupervisorEval = {
  id?: string;
  cycleId?: string;
  employeeId: string;
  evaluatorId: string;
  evaluatorName: string;
  status?: string;
};

type SupervisorEvalSource = {
  id: string;
  cycleId: string;
  evaluatorId: string;
  employeeId: string;
  status: string;
  performanceStars: number | null;
  performanceComment: string;
  abilityStars: number | null;
  abilityComment: string;
  comprehensiveStars: number | null;
  learningStars: number | null;
  adaptabilityStars: number | null;
  valuesStars: number | null;
  valuesComment: string;
  candidStars: number | null;
  candidComment: string;
  progressStars: number | null;
  progressComment: string;
  altruismStars: number | null;
  altruismComment: string;
  rootStars: number | null;
  rootComment: string;
};

type PeerReviewTarget = {
  id: string;
  cycleId: string;
  reviewerId: string;
  revieweeId: string;
  revieweeName: string;
  status: string;
};

type PeerReviewSource = {
  id: string;
  cycleId: string;
  reviewerId: string;
  revieweeId: string;
  revieweeName: string;
  status: string;
  performanceStars: number | null;
  performanceComment: string;
  comprehensiveStars: number | null;
  comprehensiveComment: string;
  learningStars: number | null;
  learningComment: string;
  adaptabilityStars: number | null;
  adaptabilityComment: string;
  abilityComment: string;
  candidStars: number | null;
  candidComment: string;
  progressStars: number | null;
  progressComment: string;
  altruismStars: number | null;
  altruismComment: string;
  rootStars: number | null;
  rootComment: string;
};

type PeerReviewUpdatePayload = ReturnType<typeof createPeerReviewPayloadFromSupervisorEval>;
type SupervisorEvalInsertPayload = ReturnType<typeof createSupervisorEvalPayloadFromPeerReview>;

type LizelongPlanRow = {
  reviewId: string;
  revieweeId: string;
  revieweeName: string;
  sourceEvalId: string;
  payload: PeerReviewUpdatePayload;
};

type QiuxiangPlanRow = {
  employeeId: string;
  employeeName: string;
  payload: SupervisorEvalInsertPayload;
};

type MissingSource = {
  targetId: string;
  targetName: string;
  reason: string;
};

type BuildPlanResult = {
  cycle: Cycle;
  lizelong: {
    pendingCount: number;
    rowsToUpdate: LizelongPlanRow[];
    missingSources: MissingSource[];
  };
  qiuxiang: {
    pendingCount: number;
    rowsToCreate: QiuxiangPlanRow[];
    missingSources: MissingSource[];
  };
};

export function combineComments(
  items: Array<{ label: string; comment: string | null | undefined }>,
): string {
  return items
    .map(({ label, comment }) => {
      const text = (comment || "").trim();
      return text ? `${label}：${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function createPeerReviewPayloadFromSupervisorEval(
  source: SupervisorEvalSource,
  now = new Date(),
) {
  const abilityComment = (source.abilityComment || "").trim();
  return {
    performanceStars: source.performanceStars,
    performanceComment: source.performanceComment || "",
    comprehensiveStars: source.comprehensiveStars,
    comprehensiveComment: abilityComment,
    learningStars: source.learningStars,
    learningComment: abilityComment,
    adaptabilityStars: source.adaptabilityStars,
    adaptabilityComment: abilityComment,
    abilityComment,
    candidStars: source.candidStars,
    candidComment: source.candidComment || "",
    progressStars: source.progressStars,
    progressComment: source.progressComment || "",
    altruismStars: source.altruismStars,
    altruismComment: source.altruismComment || "",
    rootStars: source.rootStars,
    rootComment: source.rootComment || "",
    status: "SUBMITTED",
    submittedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  } as const;
}

export function createSupervisorEvalPayloadFromPeerReview(
  source: PeerReviewSource,
  now = new Date(),
) {
  const performanceStars = source.performanceStars;
  const comprehensiveStars = source.comprehensiveStars;
  const learningStars = source.learningStars;
  const adaptabilityStars = source.adaptabilityStars;
  const candidStars = source.candidStars;
  const progressStars = source.progressStars;
  const altruismStars = source.altruismStars;
  const rootStars = source.rootStars;

  const abilityStars = computeRoundedAbilityStars(
    comprehensiveStars,
    learningStars,
    adaptabilityStars,
  );
  const valuesStars = computeRoundedValuesStars(
    candidStars,
    progressStars,
    altruismStars,
    rootStars,
  );
  const weightedScore = computeWeightedScoreFromDimensions({
    performanceStars,
    comprehensiveStars,
    learningStars,
    adaptabilityStars,
    candidStars,
    progressStars,
    altruismStars,
    rootStars,
  });

  return {
    performanceStars,
    performanceComment: source.performanceComment || "",
    comprehensiveStars,
    learningStars,
    adaptabilityStars,
    abilityStars,
    abilityComment:
      combineComments([
        { label: "综合能力", comment: source.comprehensiveComment },
        { label: "学习能力", comment: source.learningComment },
        { label: "适应能力", comment: source.adaptabilityComment },
      ]) || source.abilityComment || "",
    valuesStars,
    valuesComment:
      combineComments([
        { label: "坦诚真实", comment: source.candidComment },
        { label: "极致进取", comment: source.progressComment },
        { label: "成就利他", comment: source.altruismComment },
        { label: "ROOT", comment: source.rootComment },
      ]) || "",
    candidStars,
    candidComment: source.candidComment || "",
    progressStars,
    progressComment: source.progressComment || "",
    altruismStars,
    altruismComment: source.altruismComment || "",
    rootStars,
    rootComment: source.rootComment || "",
    weightedScore,
    status: "SUBMITTED",
    submittedAt: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  } as const;
}

function ensureSubmittedSource(status: string, kind: string, name: string) {
  if (status !== "SUBMITTED") {
    throw new Error(`${kind}源记录不是 SUBMITTED：${name}`);
  }
}

export function buildCopyPlan(args: {
  cycle: Cycle;
  users: UserRow[];
  allSupervisorEvals: ExistingSupervisorEval[];
  lizelongSupervisorSources: SupervisorEvalSource[];
  lizelongPendingPeerTargets: PeerReviewTarget[];
  qiuxiangPeerSources: PeerReviewSource[];
  qiuxiangExistingSupervisorEvals: ExistingSupervisorEval[];
  now?: Date;
}) {
  const {
    cycle,
    users,
    allSupervisorEvals,
    lizelongSupervisorSources,
    lizelongPendingPeerTargets,
    qiuxiangPeerSources,
    qiuxiangExistingSupervisorEvals,
    now = new Date(),
  } = args;

  if (cycle.status !== "SUPERVISOR_EVAL") {
    throw new Error(`当前周期状态为 ${cycle.status}，不是 SUPERVISOR_EVAL，禁止执行`);
  }

  const lizelong = users.find((item) => item.name === LIZELONG_NAME);
  const qiuxiang = users.find((item) => item.name === QIUXIANG_NAME);
  if (!lizelong) throw new Error(`未找到用户：${LIZELONG_NAME}`);
  if (!qiuxiang) throw new Error(`未找到用户：${QIUXIANG_NAME}`);

  const lizelongSourceByEmployeeId = new Map(
    lizelongSupervisorSources.map((item) => [item.employeeId, item]),
  );
  const lizelongRowsToUpdate: LizelongPlanRow[] = [];
  const lizelongMissingSources: MissingSource[] = [];

  for (const target of lizelongPendingPeerTargets) {
    const source = lizelongSourceByEmployeeId.get(target.revieweeId);
    if (!source) {
      lizelongMissingSources.push({
        targetId: target.revieweeId,
        targetName: target.revieweeName,
        reason: "未找到李泽龙已提交的初评记录",
      });
      continue;
    }
    ensureSubmittedSource(source.status, "初评", target.revieweeName);
    lizelongRowsToUpdate.push({
      reviewId: target.id,
      revieweeId: target.revieweeId,
      revieweeName: target.revieweeName,
      sourceEvalId: source.id,
      payload: createPeerReviewPayloadFromSupervisorEval(source, now),
    });
  }

  const assignments = buildSupervisorAssignmentMap(users, allSupervisorEvals);
  const qiuxiangCurrentTargets = [...assignments.values()].filter((assignment) =>
    assignment.currentEvaluatorIds.includes(qiuxiang.id),
  );
  const existingQiuxiangEvalEmployeeIds = new Set(
    qiuxiangExistingSupervisorEvals.map((item) => item.employeeId),
  );
  const qiuxiangPendingTargets = qiuxiangCurrentTargets
    .filter((assignment) => !existingQiuxiangEvalEmployeeIds.has(assignment.employeeId))
    .map((assignment) => ({
      employeeId: assignment.employeeId,
      employeeName: assignment.employeeName,
    }));

  const qiuxiangPeerByEmployeeId = new Map(
    qiuxiangPeerSources.map((item) => [item.revieweeId, item]),
  );
  const qiuxiangRowsToCreate: QiuxiangPlanRow[] = [];
  const qiuxiangMissingSources: MissingSource[] = [];

  for (const target of qiuxiangPendingTargets) {
    const source = qiuxiangPeerByEmployeeId.get(target.employeeId);
    if (!source) {
      qiuxiangMissingSources.push({
        targetId: target.employeeId,
        targetName: target.employeeName,
        reason: "未找到邱翔已提交的360记录",
      });
      continue;
    }
    ensureSubmittedSource(source.status, "360", target.employeeName);
    qiuxiangRowsToCreate.push({
      employeeId: target.employeeId,
      employeeName: target.employeeName,
      payload: createSupervisorEvalPayloadFromPeerReview(source, now),
    });
  }

  return {
    cycle,
    lizelong: {
      pendingCount: lizelongPendingPeerTargets.length,
      rowsToUpdate: lizelongRowsToUpdate,
      missingSources: lizelongMissingSources,
    },
    qiuxiang: {
      pendingCount: qiuxiangPendingTargets.length,
      rowsToCreate: qiuxiangRowsToCreate,
      missingSources: qiuxiangMissingSources,
    },
  } satisfies BuildPlanResult;
}

function getDb() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("缺少 TURSO_DATABASE_URL 或 TURSO_AUTH_TOKEN");
  }
  return createClient({ url, authToken });
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
  const cycle = cycleResult.rows[0] as unknown as Cycle | undefined;
  if (!cycle) {
    throw new Error("未找到当前活动周期");
  }

  const usersResult = await db.execute(`
    SELECT
      u.id,
      u.name,
      u.department,
      u.role,
      u.supervisorId,
      s.id AS supervisorRefId,
      s.name AS supervisorName
    FROM User u
    LEFT JOIN User s ON s.id = u.supervisorId
  `);

  const allSupervisorEvalsResult = await db.execute({
    sql: `
      SELECT
        se.id,
        se.cycleId,
        se.employeeId,
        se.evaluatorId,
        ev.name AS evaluatorName,
        se.status
      FROM SupervisorEval se
      JOIN User ev ON ev.id = se.evaluatorId
      WHERE se.cycleId = ?
    `,
    args: [cycle.id],
  });

  const lizelongSupervisorSourcesResult = await db.execute({
    sql: `
      SELECT
        se.id,
        se.cycleId,
        se.evaluatorId,
        se.employeeId,
        se.status,
        se.performanceStars,
        se.performanceComment,
        se.abilityStars,
        se.abilityComment,
        se.comprehensiveStars,
        se.learningStars,
        se.adaptabilityStars,
        se.valuesStars,
        se.valuesComment,
        se.candidStars,
        se.candidComment,
        se.progressStars,
        se.progressComment,
        se.altruismStars,
        se.altruismComment,
        se.rootStars,
        se.rootComment
      FROM SupervisorEval se
      JOIN User ev ON ev.id = se.evaluatorId
      WHERE se.cycleId = ? AND ev.name = ?
    `,
    args: [cycle.id, LIZELONG_NAME],
  });

  const lizelongPendingPeerTargetsResult = await db.execute({
    sql: `
      SELECT
        pr.id,
        pr.cycleId,
        pr.reviewerId,
        pr.revieweeId,
        ru.name AS revieweeName,
        pr.status
      FROM PeerReview pr
      JOIN User rv ON rv.id = pr.reviewerId
      JOIN User ru ON ru.id = pr.revieweeId
      WHERE pr.cycleId = ?
        AND rv.name = ?
        AND pr.status NOT IN ('SUBMITTED', 'DECLINED')
      ORDER BY ru.name
    `,
    args: [cycle.id, LIZELONG_NAME],
  });

  const qiuxiangPeerSourcesResult = await db.execute({
    sql: `
      SELECT
        pr.id,
        pr.cycleId,
        pr.reviewerId,
        pr.revieweeId,
        ru.name AS revieweeName,
        pr.status,
        pr.performanceStars,
        pr.performanceComment,
        pr.comprehensiveStars,
        pr.comprehensiveComment,
        pr.learningStars,
        pr.learningComment,
        pr.adaptabilityStars,
        pr.adaptabilityComment,
        pr.abilityComment,
        pr.candidStars,
        pr.candidComment,
        pr.progressStars,
        pr.progressComment,
        pr.altruismStars,
        pr.altruismComment,
        pr.rootStars,
        pr.rootComment
      FROM PeerReview pr
      JOIN User rv ON rv.id = pr.reviewerId
      JOIN User ru ON ru.id = pr.revieweeId
      WHERE pr.cycleId = ?
        AND rv.name = ?
        AND pr.status = 'SUBMITTED'
    `,
    args: [cycle.id, QIUXIANG_NAME],
  });

  const qiuxiangExistingSupervisorEvalsResult = await db.execute({
    sql: `
      SELECT
        se.id,
        se.cycleId,
        se.employeeId,
        se.evaluatorId,
        ev.name AS evaluatorName,
        se.status
      FROM SupervisorEval se
      JOIN User ev ON ev.id = se.evaluatorId
      WHERE se.cycleId = ? AND ev.name = ?
    `,
    args: [cycle.id, QIUXIANG_NAME],
  });

  const users: UserRow[] = usersResult.rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    department: row.department as string,
    role: row.role as string,
    supervisorId: (row.supervisorId as string | null) ?? null,
    supervisor: row.supervisorName
      ? {
          id: row.supervisorRefId as string,
          name: row.supervisorName as string,
        }
      : null,
  }));

  const allSupervisorEvals: ExistingSupervisorEval[] = allSupervisorEvalsResult.rows.map((row) => ({
    id: row.id as string,
    cycleId: row.cycleId as string,
    employeeId: row.employeeId as string,
    evaluatorId: row.evaluatorId as string,
    evaluatorName: row.evaluatorName as string,
    status: row.status as string,
  }));

  return {
    cycle,
    users,
    allSupervisorEvals,
    lizelongSupervisorSources: lizelongSupervisorSourcesResult.rows as unknown as SupervisorEvalSource[],
    lizelongPendingPeerTargets: lizelongPendingPeerTargetsResult.rows as unknown as PeerReviewTarget[],
    qiuxiangPeerSources: qiuxiangPeerSourcesResult.rows as unknown as PeerReviewSource[],
    qiuxiangExistingSupervisorEvals:
      qiuxiangExistingSupervisorEvalsResult.rows as unknown as ExistingSupervisorEval[],
  };
}

function printSummary(plan: BuildPlanResult, mode: "dry-run" | "apply") {
  console.log(`模式: ${mode}`);
  console.log(`周期: ${plan.cycle.name} (${plan.cycle.status})`);
  console.log(`\n${LIZELONG_NAME}：待环评 ${plan.lizelong.pendingCount} 条，可复制 ${plan.lizelong.rowsToUpdate.length} 条，缺源 ${plan.lizelong.missingSources.length} 条`);
  for (const row of plan.lizelong.rowsToUpdate) {
    console.log(`- copy 初评 -> 环评: ${row.revieweeName}`);
  }
  for (const row of plan.lizelong.missingSources) {
    console.log(`- 缺源: ${row.targetName} (${row.reason})`);
  }

  console.log(`\n${QIUXIANG_NAME}：待初评 ${plan.qiuxiang.pendingCount} 条，可复制 ${plan.qiuxiang.rowsToCreate.length} 条，缺源 ${plan.qiuxiang.missingSources.length} 条`);
  for (const row of plan.qiuxiang.rowsToCreate) {
    console.log(`- copy 360 -> 初评: ${row.employeeName}`);
  }
  for (const row of plan.qiuxiang.missingSources) {
    console.log(`- 缺源: ${row.targetName} (${row.reason})`);
  }
}

async function applyPlan(plan: BuildPlanResult) {
  const db = getDb();
  for (const row of plan.lizelong.rowsToUpdate) {
    await db.execute({
      sql: `
        UPDATE PeerReview
        SET
          performanceStars = ?,
          performanceComment = ?,
          comprehensiveStars = ?,
          comprehensiveComment = ?,
          learningStars = ?,
          learningComment = ?,
          adaptabilityStars = ?,
          adaptabilityComment = ?,
          abilityComment = ?,
          candidStars = ?,
          candidComment = ?,
          progressStars = ?,
          progressComment = ?,
          altruismStars = ?,
          altruismComment = ?,
          rootStars = ?,
          rootComment = ?,
          status = ?,
          submittedAt = ?,
          updatedAt = ?
        WHERE id = ?
      `,
      args: [
        row.payload.performanceStars,
        row.payload.performanceComment,
        row.payload.comprehensiveStars,
        row.payload.comprehensiveComment,
        row.payload.learningStars,
        row.payload.learningComment,
        row.payload.adaptabilityStars,
        row.payload.adaptabilityComment,
        row.payload.abilityComment,
        row.payload.candidStars,
        row.payload.candidComment,
        row.payload.progressStars,
        row.payload.progressComment,
        row.payload.altruismStars,
        row.payload.altruismComment,
        row.payload.rootStars,
        row.payload.rootComment,
        row.payload.status,
        row.payload.submittedAt,
        row.payload.updatedAt,
        row.reviewId,
      ],
    });
  }

  const qiuxiang = (await loadContext()).users.find((item) => item.name === QIUXIANG_NAME);
  if (!qiuxiang) {
    throw new Error(`未找到用户：${QIUXIANG_NAME}`);
  }

  for (const row of plan.qiuxiang.rowsToCreate) {
    await db.execute({
      sql: `
        INSERT INTO SupervisorEval (
          id,
          cycleId,
          evaluatorId,
          employeeId,
          performanceStars,
          performanceComment,
          abilityStars,
          abilityComment,
          comprehensiveStars,
          learningStars,
          adaptabilityStars,
          valuesStars,
          valuesComment,
          candidStars,
          candidComment,
          progressStars,
          progressComment,
          altruismStars,
          altruismComment,
          rootStars,
          rootComment,
          weightedScore,
          status,
          submittedAt,
          createdAt,
          updatedAt
        ) VALUES (
          lower(hex(randomblob(4))) || lower(hex(randomblob(2))) || '4' || substr(lower(hex(randomblob(2))), 2) || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || lower(hex(randomblob(6))),
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `,
      args: [
        plan.cycle.id,
        qiuxiang.id,
        row.employeeId,
        row.payload.performanceStars,
        row.payload.performanceComment,
        row.payload.abilityStars,
        row.payload.abilityComment,
        row.payload.comprehensiveStars,
        row.payload.learningStars,
        row.payload.adaptabilityStars,
        row.payload.valuesStars,
        row.payload.valuesComment,
        row.payload.candidStars,
        row.payload.candidComment,
        row.payload.progressStars,
        row.payload.progressComment,
        row.payload.altruismStars,
        row.payload.altruismComment,
        row.payload.rootStars,
        row.payload.rootComment,
        row.payload.weightedScore,
        row.payload.status,
        row.payload.submittedAt,
        row.payload.createdAt,
        row.payload.updatedAt,
      ],
    });
  }
}

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const context = await loadContext();
  const plan = buildCopyPlan(context);
  printSummary(plan, mode);

  if (mode === "dry-run") return;

  await applyPlan(plan);
  console.log("\n已执行 apply。建议马上再跑一次 dry-run 验证剩余待补记录。");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
