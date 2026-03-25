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

  console.log("\nDone!");
}

main().catch(console.error);
