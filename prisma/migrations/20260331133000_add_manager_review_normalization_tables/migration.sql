CREATE TABLE IF NOT EXISTS "ManagerReviewNormalizationSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cycleId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "strategy" TEXT NOT NULL DEFAULT 'REVIEWER_THEN_DEPARTMENT_BUCKET',
  "targetBucketCount" INTEGER NOT NULL DEFAULT 5,
  "rawRecordCount" INTEGER NOT NULL,
  "reviewerNormalizedCount" INTEGER NOT NULL DEFAULT 0,
  "departmentNormalizedCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagerReviewNormalizationSnapshot_cycleId_fkey"
    FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ManagerReviewNormalizationEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "snapshotId" TEXT NOT NULL,
  "sourceRecordId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "subjectName" TEXT NOT NULL DEFAULT '',
  "department" TEXT NOT NULL DEFAULT '',
  "raterId" TEXT,
  "raterName" TEXT NOT NULL DEFAULT '',
  "rawScore" REAL,
  "rawStars" INTEGER,
  "reviewerBiasDelta" REAL,
  "reviewerAdjustedScore" REAL,
  "reviewerNormalizedStars" INTEGER,
  "reviewerRankIndex" INTEGER,
  "departmentNormalizedStars" INTEGER,
  "departmentRankIndex" INTEGER,
  "movement" TEXT NOT NULL DEFAULT 'UNCHANGED',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagerReviewNormalizationEntry_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "ManagerReviewNormalizationSnapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ManagerReviewNormalizationApplication" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cycleId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "appliedById" TEXT,
  "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revertedById" TEXT,
  "revertedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagerReviewNormalizationApplication_cycleId_fkey"
    FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ManagerReviewNormalizationApplication_snapshotId_cycleId_source_fkey"
    FOREIGN KEY ("snapshotId", "cycleId", "source") REFERENCES "ManagerReviewNormalizationSnapshot" ("id", "cycleId", "source") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ManagerReviewNormalizationSnapshot_id_cycleId_source_key"
  ON "ManagerReviewNormalizationSnapshot"("id", "cycleId", "source");
CREATE INDEX IF NOT EXISTS "ManagerReviewNormalizationSnapshot_cycleId_source_idx"
  ON "ManagerReviewNormalizationSnapshot"("cycleId", "source");
CREATE INDEX IF NOT EXISTS "ManagerReviewNormalizationSnapshot_cycleId_createdAt_idx"
  ON "ManagerReviewNormalizationSnapshot"("cycleId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "ManagerReviewNormalizationEntry_snapshotId_sourceRecordId_key"
  ON "ManagerReviewNormalizationEntry"("snapshotId", "sourceRecordId");
CREATE INDEX IF NOT EXISTS "ManagerReviewNormalizationEntry_snapshotId_department_idx"
  ON "ManagerReviewNormalizationEntry"("snapshotId", "department");
CREATE INDEX IF NOT EXISTS "ManagerReviewNormalizationEntry_snapshotId_reviewerNormalizedStars_idx"
  ON "ManagerReviewNormalizationEntry"("snapshotId", "reviewerNormalizedStars");

CREATE UNIQUE INDEX IF NOT EXISTS "ManagerReviewNormalizationApplication_cycleId_source_key"
  ON "ManagerReviewNormalizationApplication"("cycleId", "source");
CREATE INDEX IF NOT EXISTS "ManagerReviewNormalizationApplication_snapshotId_idx"
  ON "ManagerReviewNormalizationApplication"("snapshotId");
CREATE INDEX IF NOT EXISTS "ManagerReviewNormalizationApplication_cycleId_source_revertedAt_idx"
  ON "ManagerReviewNormalizationApplication"("cycleId", "source", "revertedAt");
