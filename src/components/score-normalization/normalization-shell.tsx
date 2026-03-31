"use client";

import { ChangePreviewTable } from "./change-preview-table";
import { DistributionDiffChart } from "./distribution-diff-chart";
import { NormalizationOverview } from "./normalization-overview";
import { ApplyPanel } from "./apply-panel";
import { RaterBiasTable } from "./rater-bias-table";
import type {
  ScoreNormalizationApplicationState,
  ScoreNormalizationMovementRow,
  ScoreNormalizationRaterBiasRow,
  ScoreNormalizationWorkspaceSummary,
  ScoreNormalizationSource,
  ScoreNormalizationBucketSummary,
} from "./types";

type NormalizationShellProps = {
  source: ScoreNormalizationSource;
  cycleName: string;
  summary: ScoreNormalizationWorkspaceSummary;
  rawDistribution: ScoreNormalizationBucketSummary[];
  simulatedDistribution: ScoreNormalizationBucketSummary[];
  raterBiasRows: ScoreNormalizationRaterBiasRow[];
  movementRows: ScoreNormalizationMovementRow[];
  applicationState: ScoreNormalizationApplicationState;
  onApply: () => Promise<void> | void;
  onRevert: () => Promise<void> | void;
  applying?: boolean;
  reverting?: boolean;
};

export function NormalizationShell({
  source,
  cycleName,
  summary,
  rawDistribution,
  simulatedDistribution,
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
      <NormalizationOverview
        source={source}
        cycleName={cycleName}
        summary={summary}
        applicationState={applicationState}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <DistributionDiffChart rawDistribution={rawDistribution} simulatedDistribution={simulatedDistribution} />
        <RaterBiasTable raterBiasRows={raterBiasRows} />
      </div>

      <ChangePreviewTable movementRows={movementRows} />

      <ApplyPanel
        source={source}
        applicationState={applicationState}
        onApply={onApply}
        onRevert={onRevert}
        applying={applying}
        reverting={reverting}
      />
    </section>
  );
}
