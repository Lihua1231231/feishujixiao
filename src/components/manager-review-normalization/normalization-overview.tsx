"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type {
  ManagerReviewNormalizationApplicationState,
  ManagerReviewNormalizationSummary,
} from "./types";

type NormalizationOverviewProps = {
  cycleName: string;
  summary: ManagerReviewNormalizationSummary;
  application: ManagerReviewNormalizationApplicationState;
};

export function NormalizationOverview({
  cycleName,
  summary,
  application,
}: NormalizationOverviewProps) {
  return (
    <section className="rounded-[28px] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(247,242,233,0.94))] p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">绩效初评分布校准</Badge>
            <Badge variant={summary.workspaceState === "STANDARDIZED" ? "success" : "outline"}>
              {summary.workspaceState}
            </Badge>
            <Badge variant="secondary">{cycleName}</Badge>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">绩效初评分布校准</h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              这里先把原始分布、模拟后的分布和应用状态放在一起，方便快速看出整体偏高、偏低，或者已经切换到标准化口径。
            </p>
            <p className="max-w-3xl text-sm leading-7 text-foreground">
              页面只展示绩效初评的校准视图，不依赖后台操作即可完成静态预览和方案确认。
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px] xl:grid-cols-2">
          <Card size="sm" className="border-border/60 shadow-none">
            <CardContent className="space-y-1 py-3">
              <p className="text-xs text-muted-foreground">当前源人数</p>
              <p className="text-xl font-semibold text-foreground">{summary.currentSourceCount}</p>
              <p className="text-xs text-muted-foreground">本页正在展示的绩效初评人数</p>
            </CardContent>
          </Card>
          <Card size="sm" className="border-border/60 shadow-none">
            <CardContent className="space-y-1 py-3">
              <p className="text-xs text-muted-foreground">异常评分人</p>
              <p className="text-xl font-semibold text-foreground">{summary.abnormalRaterCount}</p>
              <p className="text-xs text-muted-foreground">分数明显偏高或偏低的评分人</p>
            </CardContent>
          </Card>
          <Card size="sm" className="border-border/60 shadow-none">
            <CardContent className="space-y-1 py-3">
              <p className="text-xs text-muted-foreground">变化人数</p>
              <p className="text-xl font-semibold text-foreground">{summary.shiftedPeopleCount}</p>
              <p className="text-xs text-muted-foreground">标准化后会变化的对象数</p>
            </CardContent>
          </Card>
          <Card size="sm" className="border-border/60 shadow-none">
            <CardContent className="space-y-1 py-3">
              <p className="text-xs text-muted-foreground">偏斜部门</p>
              <p className="text-xl font-semibold text-foreground">{summary.skewedDepartmentCount}</p>
              <p className="text-xs text-muted-foreground">与整体分布偏离较明显的部门数</p>
            </CardContent>
          </Card>
          <Card size="sm" className="border-border/60 shadow-none sm:col-span-2">
            <CardContent className="space-y-1 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-muted-foreground">最近应用状态</p>
                <Badge variant={application.workspaceState === "STANDARDIZED" ? "success" : "outline"}>
                  {application.workspaceState}
                </Badge>
                {application.rollbackVisible ? <Badge variant="warning">可回退</Badge> : null}
              </div>
              <p className="text-xl font-semibold text-foreground">
                {application.workspaceState === "STANDARDIZED" ? "已启用标准化" : "仍在原始分口径"}
              </p>
              <p className="text-xs text-muted-foreground">
                snapshotId: {application.snapshotId ?? "—"} · rollbackVisible: {application.rollbackVisible ? "true" : "false"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

