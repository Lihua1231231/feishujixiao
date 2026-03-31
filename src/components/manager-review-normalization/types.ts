export type ManagerReviewNormalizationBucketSummary = {
  bucketIndex: number;
  bucketLabel: string;
  count: number;
  pct: number;
  notes?: string;
};

export type ManagerReviewNormalizationSummary = {
  currentSourceCount: number;
  abnormalRaterCount: number;
  shiftedPeopleCount: number;
  skewedDepartmentCount: number;
  workspaceState: "RAW" | "STANDARDIZED";
};

export type ManagerReviewNormalizationRaterBiasRow = {
  raterId: string;
  raterName: string;
  raterDepartment: string | null;
  sampleCount: number;
  averageScore: number | null;
  offset: number | null;
  tendency: "偏高" | "偏低" | "正常";
  isAbnormal: boolean;
};

export type ManagerReviewNormalizationMovementRow = {
  sourceRecordId: string;
  subjectName: string;
  subjectDepartment: string | null;
  rawScore: number | null;
  rawBucket: number | null;
  reviewerNormalizedBucket: number | null;
  departmentNormalizedBucket: number | null;
  rankDelta: number | null;
  movementLabel: "上调" | "下调" | "不变" | "待定";
};

export type ManagerReviewNormalizationApplicationState = {
  workspaceState: "RAW" | "STANDARDIZED";
  appliedAt: string | null;
  revertedAt: string | null;
  snapshotId: string | null;
  rollbackVisible: boolean;
};

export type ManagerReviewNormalizationWorkspaceResponse = {
  cycle: {
    id: string;
    name: string;
  };
  cycleId: string;
  source: "SUPERVISOR_EVAL";
  strategy: "REVIEWER_THEN_DEPARTMENT_BUCKET";
  targetBucketCount: number;
  summary: ManagerReviewNormalizationSummary;
  rawDistribution: ManagerReviewNormalizationBucketSummary[];
  reviewerNormalizedDistribution: ManagerReviewNormalizationBucketSummary[];
  departmentNormalizedDistribution: ManagerReviewNormalizationBucketSummary[];
  raterBiasRows: ManagerReviewNormalizationRaterBiasRow[];
  movementRows: ManagerReviewNormalizationMovementRow[];
  applicationState: ManagerReviewNormalizationApplicationState;
};
