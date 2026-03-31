"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ScoreNormalizationBucketSummary } from "./types";

type DistributionDiffChartProps = {
  rawDistribution: ScoreNormalizationBucketSummary[];
  simulatedDistribution: ScoreNormalizationBucketSummary[];
};

function formatSignedNumber(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function formatSignedPct(value: number) {
  const rounded = Math.abs(value).toFixed(1);
  return value > 0 ? `+${rounded}%` : value < 0 ? `-${rounded}%` : `0%`;
}

function DistributionBar({
  label,
  count,
  pct,
  total,
  tone,
}: {
  label: string;
  count: number;
  pct: number;
  total: number;
  tone: "raw" | "simulated";
}) {
  const width = total > 0 ? Math.max(8, (count / total) * 100) : 8;
  const barClass = tone === "raw" ? "bg-sky-500" : "bg-emerald-500";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {count} 人 · {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function DistributionDiffChart({ rawDistribution, simulatedDistribution }: DistributionDiffChartProps) {
  const total = rawDistribution.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className="rounded-[28px] border-border/60 shadow-none">
      <CardHeader>
        <CardTitle className="text-base text-foreground">原始分布与模拟分布</CardTitle>
        <CardDescription className="text-muted-foreground">
          先把原始分和标准化分放在一起看，再看每个星级的数量和占比变化。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-xs font-medium text-muted-foreground sm:grid-cols-[68px_1fr_1fr_92px]">
          <span className="hidden sm:block" />
          <span>原始分</span>
          <span>标准化分</span>
          <span className="hidden text-right sm:block">变化</span>
        </div>
        <div className="space-y-4">
          {rawDistribution.map((raw, index) => {
            const simulated = simulatedDistribution[index] ?? raw;
            const deltaCount = simulated.count - raw.count;
            const deltaPct = simulated.pct - raw.pct;

            return (
              <div key={raw.bucketIndex} className="grid gap-3 rounded-2xl border border-border/50 p-4 sm:grid-cols-[68px_1fr_1fr_92px] sm:items-center">
                <div className="flex items-center gap-2 sm:block">
                  <p className="text-sm font-semibold text-foreground">{raw.bucketLabel}</p>
                  <Badge variant="outline" className="sm:mt-2">
                    {raw.bucketIndex} 桶
                  </Badge>
                </div>
                <DistributionBar label="原始" count={raw.count} pct={raw.pct} total={total} tone="raw" />
                <DistributionBar label="模拟" count={simulated.count} pct={simulated.pct} total={total} tone="simulated" />
                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:text-right">
                  <Badge variant={deltaCount === 0 ? "secondary" : deltaCount > 0 ? "success" : "warning"}>
                    {formatSignedNumber(deltaCount)} 人
                  </Badge>
                  <p className="text-xs text-muted-foreground">{formatSignedPct(deltaPct)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

