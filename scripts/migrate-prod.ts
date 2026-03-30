import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function main() {
  // Check existing columns
  const info = await db.execute("PRAGMA table_info(SupervisorEval)");
  const existingCols = new Set(info.rows.map(r => r.name as string));
  console.log("Existing columns:", [...existingCols].join(", "));

  // Columns to add to SupervisorEval
  const supEvalCols = [
    ["comprehensiveStars", "INTEGER"],
    ["learningStars", "INTEGER"],
    ["adaptabilityStars", "INTEGER"],
    ["candidStars", "INTEGER"],
    ["candidComment", "TEXT DEFAULT ''"],
    ["progressStars", "INTEGER"],
    ["progressComment", "TEXT DEFAULT ''"],
    ["altruismStars", "INTEGER"],
    ["altruismComment", "TEXT DEFAULT ''"],
    ["rootStars", "INTEGER"],
    ["rootComment", "TEXT DEFAULT ''"],
  ];

  for (const [col, type] of supEvalCols) {
    if (existingCols.has(col)) {
      console.log(`SKIP: SupervisorEval.${col} already exists`);
      continue;
    }
    await db.execute(`ALTER TABLE SupervisorEval ADD COLUMN ${col} ${type}`);
    console.log(`ADD: SupervisorEval.${col}`);
  }

  await db.execute("DROP INDEX IF EXISTS SupervisorEval_cycleId_employeeId_key");
  console.log("DROP: SupervisorEval_cycleId_employeeId_key if exists");
  await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS SupervisorEval_cycleId_employeeId_evaluatorId_key ON SupervisorEval(cycleId, employeeId, evaluatorId)");
  await db.execute("CREATE INDEX IF NOT EXISTS SupervisorEval_cycleId_employeeId_idx ON SupervisorEval(cycleId, employeeId)");
  await db.execute("CREATE INDEX IF NOT EXISTS SupervisorEval_cycleId_evaluatorId_idx ON SupervisorEval(cycleId, evaluatorId)");
  console.log("ENSURE: SupervisorEval indexes");

  // Also check PeerReview table
  const prInfo = await db.execute("PRAGMA table_info(PeerReview)");
  const prCols = new Set(prInfo.rows.map(r => r.name as string));
  console.log("\nPeerReview existing columns:", [...prCols].join(", "));

  const peerReviewCols = [
    ["performanceStars", "INTEGER"],
    ["performanceComment", "TEXT DEFAULT ''"],
    ["comprehensiveStars", "INTEGER"],
    ["learningStars", "INTEGER"],
    ["adaptabilityStars", "INTEGER"],
    ["abilityComment", "TEXT DEFAULT ''"],
    ["candidStars", "INTEGER"],
    ["candidComment", "TEXT DEFAULT ''"],
    ["progressStars", "INTEGER"],
    ["progressComment", "TEXT DEFAULT ''"],
    ["altruismStars", "INTEGER"],
    ["altruismComment", "TEXT DEFAULT ''"],
    ["rootStars", "INTEGER"],
    ["rootComment", "TEXT DEFAULT ''"],
    ["declinedAt", "DATETIME"],
    ["declineReason", "TEXT DEFAULT ''"],
  ];

  for (const [col, type] of peerReviewCols) {
    if (prCols.has(col)) {
      console.log(`SKIP: PeerReview.${col} already exists`);
      continue;
    }
    await db.execute(`ALTER TABLE PeerReview ADD COLUMN ${col} ${type}`);
    console.log(`ADD: PeerReview.${col}`);
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS FinalReviewConfig (
      id TEXT PRIMARY KEY NOT NULL,
      cycleId TEXT NOT NULL UNIQUE,
      accessUserIds TEXT NOT NULL DEFAULT '[]',
      finalizerUserIds TEXT NOT NULL DEFAULT '[]',
      leaderEvaluatorUserIds TEXT NOT NULL DEFAULT '[]',
      leaderSubjectUserIds TEXT NOT NULL DEFAULT '[]',
      referenceStarRanges TEXT NOT NULL DEFAULT '[]',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cycleId) REFERENCES ReviewCycle(id) ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);
  console.log("ENSURE: FinalReviewConfig");

  const finalReviewConfigInfo = await db.execute("PRAGMA table_info(FinalReviewConfig)");
  const finalReviewConfigCols = new Set(finalReviewConfigInfo.rows.map(r => r.name as string));
  if (finalReviewConfigCols.has("employeeSubjectUserIds")) {
    console.log("SKIP: FinalReviewConfig.employeeSubjectUserIds already exists");
  } else {
    await db.execute("ALTER TABLE FinalReviewConfig ADD COLUMN employeeSubjectUserIds TEXT NOT NULL DEFAULT '[]'");
    console.log("ADD: FinalReviewConfig.employeeSubjectUserIds");
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS FinalReviewOpinion (
      id TEXT PRIMARY KEY NOT NULL,
      cycleId TEXT NOT NULL,
      employeeId TEXT NOT NULL,
      reviewerId TEXT NOT NULL,
      decision TEXT NOT NULL DEFAULT 'PENDING',
      suggestedStars INTEGER,
      reason TEXT NOT NULL DEFAULT '',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cycleId) REFERENCES ReviewCycle(id) ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);
  await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS FinalReviewOpinion_cycleId_employeeId_reviewerId_key ON FinalReviewOpinion(cycleId, employeeId, reviewerId)");
  await db.execute("CREATE INDEX IF NOT EXISTS FinalReviewOpinion_cycleId_employeeId_idx ON FinalReviewOpinion(cycleId, employeeId)");
  await db.execute("CREATE INDEX IF NOT EXISTS FinalReviewOpinion_cycleId_reviewerId_idx ON FinalReviewOpinion(cycleId, reviewerId)");
  console.log("ENSURE: FinalReviewOpinion");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS LeaderFinalReview (
      id TEXT PRIMARY KEY NOT NULL,
      cycleId TEXT NOT NULL,
      employeeId TEXT NOT NULL,
      evaluatorId TEXT NOT NULL,
      performanceStars INTEGER,
      performanceComment TEXT NOT NULL DEFAULT '',
      abilityStars INTEGER,
      abilityComment TEXT NOT NULL DEFAULT '',
      comprehensiveStars INTEGER,
      learningStars INTEGER,
      adaptabilityStars INTEGER,
      valuesStars INTEGER,
      valuesComment TEXT NOT NULL DEFAULT '',
      candidStars INTEGER,
      candidComment TEXT NOT NULL DEFAULT '',
      progressStars INTEGER,
      progressComment TEXT NOT NULL DEFAULT '',
      altruismStars INTEGER,
      altruismComment TEXT NOT NULL DEFAULT '',
      rootStars INTEGER,
      rootComment TEXT NOT NULL DEFAULT '',
      weightedScore REAL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      submittedAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cycleId) REFERENCES ReviewCycle(id) ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);
  await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS LeaderFinalReview_cycleId_employeeId_evaluatorId_key ON LeaderFinalReview(cycleId, employeeId, evaluatorId)");
  await db.execute("CREATE INDEX IF NOT EXISTS LeaderFinalReview_cycleId_employeeId_idx ON LeaderFinalReview(cycleId, employeeId)");
  await db.execute("CREATE INDEX IF NOT EXISTS LeaderFinalReview_cycleId_evaluatorId_idx ON LeaderFinalReview(cycleId, evaluatorId)");
  console.log("ENSURE: LeaderFinalReview");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS FinalReviewConfirmation (
      id TEXT PRIMARY KEY NOT NULL,
      cycleId TEXT NOT NULL,
      userId TEXT NOT NULL,
      confirmerId TEXT NOT NULL,
      scope TEXT NOT NULL,
      officialStars INTEGER NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cycleId) REFERENCES ReviewCycle(id) ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);
  await db.execute("CREATE INDEX IF NOT EXISTS FinalReviewConfirmation_cycleId_userId_scope_idx ON FinalReviewConfirmation(cycleId, userId, scope)");
  await db.execute("CREATE INDEX IF NOT EXISTS FinalReviewConfirmation_cycleId_confirmerId_scope_idx ON FinalReviewConfirmation(cycleId, confirmerId, scope)");
  console.log("ENSURE: FinalReviewConfirmation");

  console.log("\nDone!");
}

main().catch(console.error);
