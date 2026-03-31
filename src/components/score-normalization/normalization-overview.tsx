"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type {
  ScoreNormalizationApplicationState,
  ScoreNormalizationSource,
  ScoreNormalizationWorkspaceSummary,
} from "./types";
import {
  formatScoreNormalizationDateTime,
  getScoreNormalizationSourceOption,
} from "./types";

type NormalizationOverviewProps = {
  source: ScoreNormalizationSource;
  cycleName: string;
  summary: ScoreNormalizationWorkspaceSummary;
  applicationState: ScoreNormalizationApplicationState;
};

export function NormalizationOverview({
  source,
  cycleName,
  summary,
  applicationState,
}: NormalizationOverviewProps) {
  const sourceOption = getScoreNormalizationSourceOption(source);
  const appliedAt = formatScoreNormalizationDateTime(applicationState.appliedAt);
  const revertedAt = formatScoreNormalizationDateTime(applicationState.revertedAt);
  const applicationStatusText = applicationState.workspaceState === "STANDARDIZED"
    ? `已启用于 ${appliedAt}`
    : applicationState.revertedAt
      ? `已回退于 ${revertedAt}`
      : appliedAt;

  return (
    <section className="rounded-[28px] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,243,233,0.94))] p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{sourceOption.label}</Badge>
            <Badge variant={applicationState.workspaceState === "STANDARDIZED" ? "success" : "outline"}>
              {applicationState.workspaceState}
            </Badge>
            <Badge variant="secondary">{cycleName}</Badge>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">分布校准分析</h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{sourceOption.description}</p>
            <p className="max-w-3xl text-sm leading-7 text-foreground">
              这里先把原始分析、模拟标准化结果和应用状态摆在一起，方便快速判断是人群偏高、部门偏斜，还是已经切到了标准化口径。
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px] xl:grid-cols-2">
          <Card size="sm" className="border-border/60 shadow-none">
            <CardContent className="space-y-1 py-3">
              <p className="text-xs text-muted-foreground">当前源人数</p>
              <p className="text-xl font-semibold text-foreground">{summary.currentSourceCount}</p>
              <p className="text-xs text-muted-foreground">本页签正在分析的人数</p>
            </CardContent>
          </Card>
          <Card size="sm" className="border-border/60 shadow-none">
            <CardContent className="space-y-1 py-3">
              <p className="text-xs text-muted-foreground">异常评分人</p>
              <p className="text-xl font-semibold text-foreground">{summary.abnormalRaterCount}</p>
              <p className="text-xs text-muted-foreground">存在明显偏高或偏低倾向的评分人</p>
            </CardContent>
          </Card>
          <Card size="sm" className="border-border/60 shadow-none">
            <CardContent className="space-y-1 py-3">
              <p className="text-xs text-muted-foreground">变化人数</p>
              <p className="text-xl font-semibold text-foreground">{summary.shiftedPeopleCount}</p>
              <p className="text-xs text-muted-foreground">切到标准化后会变化的对象数</p>
            </CardContent>
          </Card>
          <Card size="sm" className="border-border/60 shadow-none">
            <CardContent className="space-y-1 py-3">
              <p className="text-xs text-muted-foreground">偏斜部门</p>
              <p className="text-xl font-semibold text-foreground">{summary.skewedDepartmentCount}</p>
              <p className="text-xs text-muted-foreground">相对整体均值偏离明显的部门数</p>
            </CardContent>
          </Card>
          <Card size="sm" className="border-border/60 shadow-none sm:col-span-2">
            <CardContent className="space-y-1 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-muted-foreground">最近应用状态</p>
                <Badge variant={summary.workspaceState === "STANDARDIZED" ? "success" : "outline"}>
                  {summary.workspaceState}
                </Badge>
                {applicationState.rollbackVisible ? <Badge variant="warning">可回退</Badge> : null}
              </div>
              <p className="text-xl font-semibold text-foreground">{applicationStatusText}</p>
              <p className="text-xs text-muted-foreground">
                workspaceState: {summary.workspaceState} · rollbackVisible: {applicationState.rollbackVisible ? "true" : "false"}
                {applicationState.revertedAt ? ` · revertedAt: ${revertedAt}` : ""}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
