CREATE TABLE "ScoreNormalizationSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cycleId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "strategy" TEXT NOT NULL DEFAULT 'RANK_BUCKET',
  "targetBucketCount" INTEGER NOT NULL DEFAULT 5,
  "rawRecordCount" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScoreNormalizationSnapshot_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ScoreNormalizationEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "snapshotId" TEXT NOT NULL,
  "sourceRecordId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "subjectName" TEXT NOT NULL DEFAULT '',
  "rawScore" REAL,
  "rankIndex" INTEGER,
  "bucketIndex" INTEGER,
  "bucketLabel" TEXT NOT NULL DEFAULT '',
  "normalizedScore" REAL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScoreNormalizationEntry_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ScoreNormalizationSnapshot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ScoreNormalizationApplication" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cycleId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revertedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ScoreNormalizationApplication_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ScoreNormalizationApplication_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ScoreNormalizationSnapshot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ScoreNormalizationSnapshot_cycleId_source_idx" ON "ScoreNormalizationSnapshot"("cycleId", "source");
CREATE INDEX "ScoreNormalizationSnapshot_cycleId_createdAt_idx" ON "ScoreNormalizationSnapshot"("cycleId", "createdAt");
CREATE UNIQUE INDEX "ScoreNormalizationEntry_snapshotId_sourceRecordId_key" ON "ScoreNormalizationEntry"("snapshotId", "sourceRecordId");
CREATE INDEX "ScoreNormalizationEntry_snapshotId_bucketIndex_idx" ON "ScoreNormalizationEntry"("snapshotId", "bucketIndex");
CREATE UNIQUE INDEX "ScoreNormalizationApplication_cycleId_source_key" ON "ScoreNormalizationApplication"("cycleId", "source");
CREATE INDEX "ScoreNormalizationApplication_snapshotId_idx" ON "ScoreNormalizationApplication"("snapshotId");
