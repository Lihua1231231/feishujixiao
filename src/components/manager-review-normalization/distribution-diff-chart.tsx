"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ManagerReviewNormalizationBucketSummary } from "./types";

type DistributionDiffChartProps = {
  rawDistribution: ManagerReviewNormalizationBucketSummary[];
  reviewerNormalizedDistribution: ManagerReviewNormalizationBucketSummary[];
  departmentNormalizedDistribution: ManagerReviewNormalizationBucketSummary[];
};

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
  tone: "raw" | "reviewer" | "department";
}) {
  const width = total > 0 ? Math.max(8, (count / total) * 100) : 8;
  const barClass =
    tone === "raw" ? "bg-sky-500" : tone === "reviewer" ? "bg-emerald-500" : "bg-violet-500";

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

export function DistributionDiffChart({
  rawDistribution,
  reviewerNormalizedDistribution,
  departmentNormalizedDistribution,
}: DistributionDiffChartProps) {
  const total = rawDistribution.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className="rounded-[28px] border-border/60 shadow-none">
      <CardHeader>
        <CardTitle className="text-base text-foreground">分布对比</CardTitle>
        <CardDescription className="text-muted-foreground">
          先看原始分，再对照两种模拟校准结果，判断整体分布是偏高还是偏低。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-xs font-medium text-muted-foreground sm:grid-cols-[68px_1fr_1fr_1fr_92px]">
          <span className="hidden sm:block" />
          <span>原始分</span>
          <span>评分人校准</span>
          <span>部门校准</span>
          <span className="hidden text-right sm:block">变化</span>
        </div>
        <div className="space-y-4">
          {rawDistribution.map((raw, index) => {
            const reviewer = reviewerNormalizedDistribution[index] ?? raw;
            const department = departmentNormalizedDistribution[index] ?? raw;
            const deltaCount = reviewer.count - raw.count;
            const deltaPct = reviewer.pct - raw.pct;

            return (
              <div
                key={raw.bucketIndex}
                className="grid gap-3 rounded-2xl border border-border/50 p-4 sm:grid-cols-[68px_1fr_1fr_1fr_92px] sm:items-center"
              >
                <div className="flex items-center gap-2 sm:block">
                  <p className="text-sm font-semibold text-foreground">{raw.bucketLabel}</p>
                  <Badge variant="outline" className="sm:mt-2">
                    {raw.bucketIndex} 桶
                  </Badge>
                </div>
                <DistributionBar label="原始" count={raw.count} pct={raw.pct} total={total} tone="raw" />
                <DistributionBar
                  label="评分人"
                  count={reviewer.count}
                  pct={reviewer.pct}
                  total={total}
                  tone="reviewer"
                />
                <DistributionBar
                  label="部门"
                  count={department.count}
                  pct={department.pct}
                  total={total}
                  tone="department"
                />
                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:text-right">
                  <Badge variant={deltaCount === 0 ? "secondary" : deltaCount > 0 ? "success" : "warning"}>
                    {deltaCount > 0 ? `+${deltaCount}` : `${deltaCount}`} 人
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {deltaPct > 0 ? `+${deltaPct.toFixed(1)}` : deltaPct.toFixed(1)}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

