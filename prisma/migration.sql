-- Migration: 深度赋智2025下半年绩效方案数据模型改造
-- 保留User表数据，重建所有其他表

-- 1. Drop existing tables (order matters due to foreign keys)
DROP TABLE IF EXISTS "CalibrationResult";
DROP TABLE IF EXISTS "Meeting";
DROP TABLE IF EXISTS "PeerReview";
DROP TABLE IF EXISTS "ReviewerNomination";
DROP TABLE IF EXISTS "SupervisorEval";
DROP TABLE IF EXISTS "SelfEvaluation";
DROP TABLE IF EXISTS "ReviewCycle";

-- 2. Recreate ReviewCycle with appeal fields
CREATE TABLE "ReviewCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "selfEvalStart" DATETIME NOT NULL,
    "selfEvalEnd" DATETIME NOT NULL,
    "peerReviewStart" DATETIME NOT NULL,
    "peerReviewEnd" DATETIME NOT NULL,
    "supervisorStart" DATETIME NOT NULL,
    "supervisorEnd" DATETIME NOT NULL,
    "calibrationStart" DATETIME NOT NULL,
    "calibrationEnd" DATETIME NOT NULL,
    "meetingStart" DATETIME NOT NULL,
    "meetingEnd" DATETIME NOT NULL,
    "appealStart" DATETIME,
    "appealEnd" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Recreate SelfEvaluation (飞书导入模式)
CREATE TABLE "SelfEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importedContent" TEXT NOT NULL DEFAULT '',
    "importedAt" DATETIME,
    "sourceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SelfEvaluation_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SelfEvaluation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 4. Recreate ReviewerNomination (双状态确认)
CREATE TABLE "ReviewerNomination" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "nominatorId" TEXT NOT NULL,
    "nomineeId" TEXT NOT NULL,
    "supervisorStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "nomineeStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "declineReason" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewerNomination_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReviewerNomination_nominatorId_fkey" FOREIGN KEY ("nominatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReviewerNomination_nomineeId_fkey" FOREIGN KEY ("nomineeId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 5. Recreate PeerReview (4维度+拒评)
CREATE TABLE "PeerReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "outputScore" INTEGER,
    "outputComment" TEXT NOT NULL DEFAULT '',
    "collaborationScore" INTEGER,
    "collaborationComment" TEXT NOT NULL DEFAULT '',
    "valuesScore" INTEGER,
    "valuesComment" TEXT NOT NULL DEFAULT '',
    "innovationScore" INTEGER,
    "innovationComment" TEXT NOT NULL DEFAULT '',
    "declinedAt" DATETIME,
    "declineReason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PeerReview_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PeerReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PeerReview_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 6. Recreate SupervisorEval (三维度星级)
CREATE TABLE "SupervisorEval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "performanceStars" INTEGER,
    "performanceComment" TEXT NOT NULL DEFAULT '',
    "abilityStars" INTEGER,
    "abilityComment" TEXT NOT NULL DEFAULT '',
    "valuesStars" INTEGER,
    "valuesComment" TEXT NOT NULL DEFAULT '',
    "weightedScore" REAL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupervisorEval_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupervisorEval_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupervisorEval_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 7. Recreate CalibrationResult (星级化)
CREATE TABLE "CalibrationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "proposedStars" REAL,
    "finalStars" INTEGER,
    "adjustedBy" TEXT,
    "adjustReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CalibrationResult_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalibrationResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 8. Recreate Meeting (unchanged)
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "meetingDate" DATETIME,
    "notes" TEXT NOT NULL DEFAULT '',
    "employeeAck" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Meeting_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Meeting_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Meeting_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 9. Create new Appeal table
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolution" TEXT NOT NULL DEFAULT '',
    "handledBy" TEXT,
    "handledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Appeal_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 10. Recreate unique indexes
CREATE UNIQUE INDEX "SelfEvaluation_cycleId_userId_key" ON "SelfEvaluation"("cycleId", "userId");
CREATE UNIQUE INDEX "ReviewerNomination_cycleId_nominatorId_nomineeId_key" ON "ReviewerNomination"("cycleId", "nominatorId", "nomineeId");
CREATE UNIQUE INDEX "PeerReview_cycleId_reviewerId_revieweeId_key" ON "PeerReview"("cycleId", "reviewerId", "revieweeId");
CREATE UNIQUE INDEX "SupervisorEval_cycleId_employeeId_evaluatorId_key" ON "SupervisorEval"("cycleId", "employeeId", "evaluatorId");
CREATE INDEX "SupervisorEval_cycleId_employeeId_idx" ON "SupervisorEval"("cycleId", "employeeId");
CREATE INDEX "SupervisorEval_cycleId_evaluatorId_idx" ON "SupervisorEval"("cycleId", "evaluatorId");
CREATE UNIQUE INDEX "CalibrationResult_cycleId_userId_key" ON "CalibrationResult"("cycleId", "userId");
CREATE UNIQUE INDEX "Meeting_cycleId_employeeId_key" ON "Meeting"("cycleId", "employeeId");
CREATE UNIQUE INDEX "Appeal_cycleId_userId_key" ON "Appeal"("cycleId", "userId");

-- 11. Final review workspace tables
CREATE TABLE "FinalReviewConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "accessUserIds" TEXT NOT NULL DEFAULT '[]',
    "finalizerUserIds" TEXT NOT NULL DEFAULT '[]',
    "leaderEvaluatorUserIds" TEXT NOT NULL DEFAULT '[]',
    "leaderSubjectUserIds" TEXT NOT NULL DEFAULT '[]',
    "referenceStarRanges" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinalReviewConfig_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "FinalReviewOpinion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" TEXT NOT NULL DEFAULT 'PENDING',
    "suggestedStars" INTEGER,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinalReviewOpinion_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "LeaderFinalReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "performanceStars" INTEGER,
    "performanceComment" TEXT NOT NULL DEFAULT '',
    "abilityStars" INTEGER,
    "abilityComment" TEXT NOT NULL DEFAULT '',
    "comprehensiveStars" INTEGER,
    "learningStars" INTEGER,
    "adaptabilityStars" INTEGER,
    "valuesStars" INTEGER,
    "valuesComment" TEXT NOT NULL DEFAULT '',
    "candidStars" INTEGER,
    "candidComment" TEXT NOT NULL DEFAULT '',
    "progressStars" INTEGER,
    "progressComment" TEXT NOT NULL DEFAULT '',
    "altruismStars" INTEGER,
    "altruismComment" TEXT NOT NULL DEFAULT '',
    "rootStars" INTEGER,
    "rootComment" TEXT NOT NULL DEFAULT '',
    "weightedScore" REAL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeaderFinalReview_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "FinalReviewConfirmation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "confirmerId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "officialStars" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinalReviewConfirmation_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FinalReviewConfig_cycleId_key" ON "FinalReviewConfig"("cycleId");
CREATE UNIQUE INDEX "FinalReviewOpinion_cycleId_employeeId_reviewerId_key" ON "FinalReviewOpinion"("cycleId", "employeeId", "reviewerId");
CREATE INDEX "FinalReviewOpinion_cycleId_employeeId_idx" ON "FinalReviewOpinion"("cycleId", "employeeId");
CREATE INDEX "FinalReviewOpinion_cycleId_reviewerId_idx" ON "FinalReviewOpinion"("cycleId", "reviewerId");
CREATE UNIQUE INDEX "LeaderFinalReview_cycleId_employeeId_evaluatorId_key" ON "LeaderFinalReview"("cycleId", "employeeId", "evaluatorId");
CREATE INDEX "LeaderFinalReview_cycleId_employeeId_idx" ON "LeaderFinalReview"("cycleId", "employeeId");
CREATE INDEX "LeaderFinalReview_cycleId_evaluatorId_idx" ON "LeaderFinalReview"("cycleId", "evaluatorId");
CREATE INDEX "FinalReviewConfirmation_cycleId_userId_scope_idx" ON "FinalReviewConfirmation"("cycleId", "userId", "scope");
CREATE INDEX "FinalReviewConfirmation_cycleId_confirmerId_scope_idx" ON "FinalReviewConfirmation"("cycleId", "confirmerId", "scope");
