"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  ScoreNormalizationApplicationState,
  ScoreNormalizationSource,
} from "./types";
import {
  formatScoreNormalizationDateTime,
  getScoreNormalizationSourceOption,
} from "./types";

type ApplyPanelProps = {
  source: ScoreNormalizationSource;
  applicationState: ScoreNormalizationApplicationState;
  onApply: () => Promise<void> | void;
  onRevert: () => Promise<void> | void;
  applying?: boolean;
  reverting?: boolean;
};

export function ApplyPanel({
  source,
  applicationState,
  onApply,
  onRevert,
  applying = false,
  reverting = false,
}: ApplyPanelProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const sourceOption = getScoreNormalizationSourceOption(source);
  const canApply = applicationState.workspaceState === "RAW" && acknowledged && !applying;
  const canRevert = applicationState.workspaceState === "STANDARDIZED" && !reverting;
  const appliedAt = formatScoreNormalizationDateTime(applicationState.appliedAt);
  const revertedAt = formatScoreNormalizationDateTime(applicationState.revertedAt);

  return (
    <Card className="rounded-[28px] border-amber-200/70 bg-amber-50/50 shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base text-foreground">最终确认区</CardTitle>
          <Badge variant={applicationState.workspaceState === "STANDARDIZED" ? "success" : "outline"}>
            {applicationState.workspaceState}
          </Badge>
          {applicationState.rollbackVisible ? <Badge variant="warning">可回退</Badge> : null}
        </div>
        <CardDescription className="text-muted-foreground">
          {sourceOption.shortLabel} 的标准化切换会影响排名和后续校准展示，所以这里保留双确认和回退入口。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-7 text-foreground">
          应用前先确认这会改变后续看到的结果口径；如果已经启用标准化，也可以从这里回退到原始分展示。
        </p>

        <label className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/30"
          />
          <span>我已理解这会影响排名和后续校准展示</span>
        </label>

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => void onApply()} disabled={!canApply}>
            应用标准化结果
          </Button>
          <Button type="button" variant="outline" onClick={() => void onRevert()} disabled={!canRevert}>
            回退到原始分
          </Button>
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          最近应用：{appliedAt}
          {applicationState.revertedAt ? ` · 回退于：${revertedAt}` : ""}
          · snapshotId: {applicationState.snapshotId ?? "—"} · rollbackVisible: {applicationState.rollbackVisible ? "true" : "false"}
        </p>
      </CardContent>
    </Card>
  );
}
