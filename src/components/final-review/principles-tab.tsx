"use client";

import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CockpitShell, type CockpitBriefingBlock, type CockpitMetric } from "./cockpit-shell";
import { ScoreBandChart } from "./score-band-chart";
import { StarDistributionChart } from "./star-distribution-chart";
import type { DistributionEntry, WorkspacePayload } from "./types";
import type { ScoreBandBucket } from "./workspace-view";

type PrinciplesTabProps = {
  cycle: NonNullable<WorkspacePayload["cycle"]>;
  config: NonNullable<WorkspacePayload["config"]>;
  overview: NonNullable<WorkspacePayload["overview"]>;
  companyDistribution: DistributionEntry[];
  scoreBandBuckets: ScoreBandBucket[];
};

function describeDeadline(end: string) {
  const diff = new Date(end).getTime() - Date.now();
  if (diff <= 0) {
    return {
      overdue: true,
      shortLabel: "已过截止时间",
      summaryLabel: "已过校准截止时间",
    };
  }

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const shortLabel = days > 0 ? `${days}天 ${hours}小时` : `${hours}小时 ${minutes}分钟`;

  return {
    overdue: false,
    shortLabel,
    summaryLabel: `距离校准截止还有 ${shortLabel}`,
  };
}

function buildSummary(cycle: NonNullable<WorkspacePayload["cycle"]>, overview: NonNullable<WorkspacePayload["overview"]>) {
  const deadline = describeDeadline(cycle.calibrationEnd);
  const pendingEmployees = Math.max(overview.progress.employeeTotalCount - overview.progress.employeeConfirmedCount, 0);
  const pendingLeaders = Math.max(overview.progress.leaderTotalCount - overview.progress.leaderConfirmedCount, 0);
  const firstRisk = overview.riskSummary[0];

  if (firstRisk) {
    return `${deadline.summaryLabel}，${firstRisk} 目前还剩 ${pendingEmployees} 位普通员工和 ${pendingLeaders} 位主管待正式拍板。`;
  }

  if (pendingEmployees === 0 && pendingLeaders === 0) {
    return deadline.overdue
      ? "已过校准截止时间，普通员工和主管层都已形成正式结论，请尽快完成最后复核。"
      : `${deadline.summaryLabel}，普通员工和主管层都已形成正式结论，当前重点是完成最后复核。`;
  }

  return deadline.overdue
    ? `已过校准截止时间，目前还剩 ${pendingEmployees} 位普通员工和 ${pendingLeaders} 位主管待正式拍板，建议先处理高风险卡点，再尽快补齐最后确认。`
    : `${deadline.summaryLabel}，目前还剩 ${pendingEmployees} 位普通员工和 ${pendingLeaders} 位主管待正式拍板，建议先处理意见分歧和高风险名单，再收口最后确认。`;
}

export function PrinciplesTab({
  cycle,
  config,
  overview,
  companyDistribution,
  scoreBandBuckets,
}: PrinciplesTabProps) {
  const badgeStyle = "rounded-full border-[color:rgba(191,127,65,0.18)] bg-[color:rgba(191,127,65,0.08)] px-3 py-1 font-medium text-[var(--cockpit-foreground)]";
  const panelStyle: CSSProperties = {
    background: "var(--cockpit-surface)",
    borderColor: "var(--cockpit-border)",
    boxShadow: "var(--shadow-xs)",
  };
  const strongPanelStyle: CSSProperties = {
    background: [
      "radial-gradient(circle at top right, rgba(255, 255, 255, 0.34), transparent 45%)",
      "linear-gradient(180deg, rgba(255, 255, 255, 0.1), transparent)",
      "var(--cockpit-surface-strong)",
    ].join(", "),
    borderColor: "var(--cockpit-border)",
    boxShadow: "var(--shadow-xs)",
  };
  const deadline = describeDeadline(cycle.calibrationEnd);
  const briefingBlocks: CockpitBriefingBlock[] = [
    {
      title: "这轮先看什么",
      content: (
        <div className="flex flex-wrap gap-2">
          {overview.principles.map((item) => (
            <Badge key={item} variant="outline" className={badgeStyle}>
              {item}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      title: "谁在拍板",
      content: (
        <ul className="space-y-2">
          {overview.chainGuidance.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ),
    },
    {
      title: "分布提醒",
      content: (
        <div className="flex flex-wrap gap-2">
          {overview.distributionHints.map((item) => (
            <Badge key={item} variant="secondary" className={badgeStyle}>
              {item}
            </Badge>
          ))}
        </div>
      ),
    },
  ];

  const leaderSubmissionText =
    overview.progress.leaderSubmittedCounts.map((item) => `${item.evaluatorName} ${item.submittedCount}`).join(" · ") || "未配置";
  const leaderEvaluatorCount = overview.progress.leaderSubmittedCounts.length;
  const leaderEvaluatorLabel = config.leaderEvaluators.length > 0
    ? config.leaderEvaluators.map((user) => user.name).join("、")
    : leaderEvaluatorCount > 0
      ? `已配置 ${leaderEvaluatorCount} 位填写人`
      : "未配置";

  const metrics: CockpitMetric[] = [
    {
      title: "普通员工意见收集进度",
      value: `${overview.progress.employeeOpinionDone}/${overview.progress.employeeOpinionTotal}`,
      description: "5位终评相关人已完成的意见数",
    },
    {
      title: "普通员工正式拍板进度",
      value: `${overview.progress.employeeConfirmedCount}/${overview.progress.employeeTotalCount}`,
      description: "最终确认人已完成正式确认的人数",
    },
    {
      title: "主管层正式拍板进度",
      value: `${overview.progress.leaderConfirmedCount}/${overview.progress.leaderTotalCount}`,
      description: "主管层已完成官方确认的人数",
    },
    {
      title: "主管层问卷填写进度",
      value: leaderSubmissionText,
      description: "每位主管层填写人已提交多少份主管层问卷",
    },
  ];

  return (
    <CockpitShell
      title="原则简报"
      description="先在这里统一口径，再去员工和主管名单里处理具体对象。"
      guideDescription="这一页告诉你本轮终评按什么原则看人、谁参与拍板、现在卡在哪。默认先看公司整体分布、当前风险和优先处理对象。"
      summaryLabel="一句话解读"
      summary={buildSummary(cycle, overview)}
      briefingBlocks={briefingBlocks}
      metrics={metrics}
      main={
        <div className="grid gap-4 lg:grid-cols-2">
          <StarDistributionChart
            title="全公司星级分布"
            description="先看公司当前整体星级落点，再决定是否要优先处理偏离建议分布的星级。"
            distribution={companyDistribution}
          />
          <ScoreBandChart
            title="分数带"
            description="普通员工当前初评加权分落在哪些分段，能帮助快速识别需要重点翻看的区间。"
            bands={scoreBandBuckets}
          />
        </div>
      }
      aside={
        <>
          <Card className="rounded-[var(--radius-2xl)] border shadow-none" style={panelStyle}>
            <CardHeader>
              <CardTitle className="text-base text-[var(--cockpit-foreground)]">本轮终评角色</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-[var(--cockpit-foreground)]">终评工作台参与人</p>
                <p className="mt-1 leading-6 text-[var(--cockpit-muted-foreground)]">{config.accessUsers.map((user) => user.name).join("、") || "未配置"}</p>
              </div>
              <div>
                <p className="font-medium text-[var(--cockpit-foreground)]">最终确认人</p>
                <p className="mt-1 leading-6 text-[var(--cockpit-muted-foreground)]">{config.finalizers.map((user) => user.name).join("、") || "未配置"}</p>
              </div>
              <div>
                <p className="font-medium text-[var(--cockpit-foreground)]">主管层双人终评填写人</p>
                <p className="mt-1 leading-6 text-[var(--cockpit-muted-foreground)]">{leaderEvaluatorLabel}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[var(--radius-2xl)] border shadow-none" style={panelStyle}>
            <CardHeader>
              <CardTitle className="text-base text-[var(--cockpit-foreground)]">风险与推进提醒</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[var(--radius-xl)] border p-4" style={strongPanelStyle}>
                <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">校准截止</p>
                <p className="mt-2 text-lg font-semibold text-[var(--cockpit-foreground)]">{deadline.shortLabel}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--cockpit-muted-foreground)]">
                  {deadline.overdue ? "当前已过截止时间，请优先补齐未完成拍板。" : "双人提交进度："}
                  {!deadline.overdue ? leaderSubmissionText : null}
                </p>
              </div>

              <div className="space-y-2">
                {(overview.riskSummary.length > 0 ? overview.riskSummary : ["当前没有额外风险提醒。"]).map((item) => (
                  <div
                    key={item}
                    className="rounded-[var(--radius-xl)] border border-[color:rgba(179,76,40,0.14)] bg-[color:rgba(255,237,230,0.7)] px-3 py-2 text-sm text-[color:#8c3b21]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      }
    />
  );
}
