export type DistributionEntry = {
  stars: number;
  count: number;
  pct: number;
  exceeded: boolean;
  delta: number;
  names: string[];
};

export type EmployeeOpinion = {
  reviewerId: string;
  reviewerName: string;
  decision: string;
  decisionLabel: string;
  suggestedStars: number | null;
  reason: string;
  isMine: boolean;
  updatedAt: string | null;
};

export type EmployeeRow = {
  id: string;
  name: string;
  department: string;
  jobTitle: string | null;
  weightedScore: number | null;
  referenceStars: number | null;
  referenceSourceLabel: string;
  officialStars: number | null;
  officialReason: string;
  officialConfirmedAt: string | null;
  agreementState: "PENDING" | "AGREED" | "DISAGREED";
  canSubmitOpinion: boolean;
  canViewOpinionDetails: boolean;
  currentEvaluatorNames: string[];
  currentEvaluatorStatuses: Array<{
    evaluatorId: string;
    evaluatorName: string;
    status: string;
    weightedScore: number | null;
  }>;
  selfEvalStatus: string | null;
  selfEvalSourceUrl: string | null;
  peerAverage: number | null;
  peerReviewSummary: {
    overall: number | null;
    performance: number | null;
    ability: number | null;
    values: number | null;
    count: number;
    reviews: Array<{
      reviewerName: string;
      performanceStars: number | null;
      performanceComment: string;
      abilityAverage: number | null;
      comprehensiveStars: number | null;
      comprehensiveComment: string;
      learningStars: number | null;
      learningComment: string;
      adaptabilityStars: number | null;
      adaptabilityComment: string;
      valuesAverage: number | null;
      candidStars: number | null;
      candidComment: string;
      progressStars: number | null;
      progressComment: string;
      altruismStars: number | null;
      altruismComment: string;
      rootStars: number | null;
      rootComment: string;
      innovationScore: number | null;
      innovationComment: string;
    }>;
  } | null;
  initialReviewDetails: Array<{
    evaluatorId: string;
    evaluatorName: string;
    status: string;
    weightedScore: number | null;
    performanceStars: number | null;
    performanceComment: string;
    abilityStars: number | null;
    abilityComment: string;
    abilityBreakdown: Array<{
      label: string;
      stars: number | null;
    }>;
    valuesStars: number | null;
    valuesComment: string;
    valuesBreakdown: Array<{
      label: string;
      stars: number | null;
      comment: string;
    }>;
  }>;
  handledCount: number;
  totalReviewerCount: number;
  summaryStats: {
    handledCount: number;
    totalReviewerCount: number;
    pendingCount: number;
    overrideCount: number;
    disagreementCount: number;
  };
  opinionSummary: Array<{
    label: string;
    count: number;
  }>;
  anomalyTags: string[];
  opinions: EmployeeOpinion[];
};

export type LeaderForm = {
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

export type LeaderEvaluation = {
  evaluatorId: string;
  evaluatorName: string;
  status: string;
  weightedScore: number | null;
  referenceStars: number | null;
  editable: boolean;
  submittedAt: string | null;
  form: LeaderForm;
};

export type LeaderRow = {
  id: string;
  name: string;
  department: string;
  jobTitle: string | null;
  officialStars: number | null;
  officialReason: string;
  officialConfirmedAt: string | null;
  canViewLeaderEvaluationDetails: boolean;
  submissionSummary: {
    configuredEvaluatorCount: number;
    submittedCount: number;
    pendingCount: number;
  };
  evaluations: LeaderEvaluation[];
  combinedWeightedScore: number | null;
  combinedReferenceStars: number | null;
  bothSubmitted: boolean;
};

export type WorkspacePayload = {
  cycle: {
    id: string;
    name: string;
    status: string;
    calibrationStart: string;
    calibrationEnd: string;
  } | null;
  canAccess: boolean;
  config: {
    employeeSubjectUserIds: string[];
    accessUsers: Array<{ id: string; name: string; department: string }>;
    finalizers: Array<{ id: string; name: string; department: string }>;
    leaderEvaluators: Array<{ id: string; name: string; department: string }>;
    leaderSubjects: Array<{ id: string; name: string; department: string }>;
  } | null;
  overview: {
    principles: string[];
    chainGuidance: string[];
    distributionHints: string[];
    companyCalibrators: Array<{ id: string; name: string; department: string; role: string }>;
    initialDimensionChecks: {
      totalCount: number;
      completeCount: number;
      missingCount: number;
      items: Array<{
        employeeId: string;
        employeeName: string;
        department: string;
        missingDimensions: string[];
        complete: boolean;
      }>;
    };
    distributionComplianceChecks: Array<{
      stars: number;
      label: string;
      target: string;
      actualCount: number;
      actualPct: number;
      compliant: boolean;
      deltaCount: number;
      summary: string;
    }>;
    riskSummary: string[];
    progress: {
      employeeOpinionDone: number;
      employeeOpinionTotal: number;
      employeeConfirmedCount: number;
      employeeTotalCount: number;
      leaderSubmittedCounts: Array<{
        evaluatorId: string;
        evaluatorName: string;
        submittedCount: number;
      }>;
      leaderConfirmedCount: number;
      leaderTotalCount: number;
    };
  } | null;
  employeeReview: {
    overview: {
      companyCount: number;
      initialEvalSubmissionRate: number;
      officialCompletionRate: number;
      pendingOfficialCount: number;
    };
    companyDistribution: DistributionEntry[];
    employeeDistribution: DistributionEntry[];
    departmentDistributions: Array<{
      department: string;
      total: number;
      distribution: DistributionEntry[];
    }>;
    employees: EmployeeRow[];
  } | null;
  leaderReview: {
    overview: {
      leaderCount: number;
      confirmedCount: number;
      evaluatorProgress: Array<{
        evaluatorId: string;
        evaluatorName: string;
        submittedCount: number;
      }>;
    };
    leaders: LeaderRow[];
    leaderDistribution: DistributionEntry[];
    companyDistributions: {
      all: DistributionEntry[];
      leaderOnly: DistributionEntry[];
      employeeOnly: DistributionEntry[];
    };
  } | null;
};
