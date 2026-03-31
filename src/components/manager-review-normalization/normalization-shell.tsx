"use client";

import { ApplyPanel } from "./apply-panel";
import { ChangePreviewTable } from "./change-preview-table";
import { DistributionDiffChart } from "./distribution-diff-chart";
import { NormalizationOverview } from "./normalization-overview";
import { RaterBiasTable } from "./rater-bias-table";
import type {
  ManagerReviewNormalizationApplicationState,
  ManagerReviewNormalizationBucketSummary,
  ManagerReviewNormalizationMovementRow,
  ManagerReviewNormalizationRaterBiasRow,
  ManagerReviewNormalizationSummary,
} from "./types";

type NormalizationShellProps = {
  cycleName: string;
  summary: ManagerReviewNormalizationSummary;
  rawDistribution: ManagerReviewNormalizationBucketSummary[];
  reviewerNormalizedDistribution: ManagerReviewNormalizationBucketSummary[];
  departmentNormalizedDistribution: ManagerReviewNormalizationBucketSummary[];
  raterBiasRows: ManagerReviewNormalizationRaterBiasRow[];
  movementRows: ManagerReviewNormalizationMovementRow[];
  applicationState: ManagerReviewNormalizationApplicationState;
  onApply: () => Promise<void> | void;
  onRevert: () => Promise<void> | void;
  applying?: boolean;
  reverting?: boolean;
};

export function NormalizationShell({
  cycleName,
  summary,
  rawDistribution,
  reviewerNormalizedDistribution,
  departmentNormalizedDistribution,
  raterBiasRows,
  movementRows,
  applicationState,
  onApply,
  onRevert,
  applying = false,
  reverting = false,
}: NormalizationShellProps) {
  return (
    <section className="space-y-5">
      <NormalizationOverview cycleName={cycleName} summary={summary} application={applicationState} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <DistributionDiffChart
          rawDistribution={rawDistribution}
          reviewerNormalizedDistribution={reviewerNormalizedDistribution}
          departmentNormalizedDistribution={departmentNormalizedDistribution}
        />
        <RaterBiasTable raterBiasRows={raterBiasRows} />
      </div>

      <ChangePreviewTable movementRows={movementRows} />

      <ApplyPanel
        application={applicationState}
        onApply={onApply}
        onRevert={onRevert}
        applying={applying}
        reverting={reverting}
      />
    </section>
  );
}
