"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QueueTabs } from "./queue-tabs";
import { RosterSearchList, type RosterSearchItem } from "./roster-search-list";
import { StarDistributionChart } from "./star-distribution-chart";
import type { DistributionEntry, LeaderRow } from "./types";
import { buildLeaderQueueGroups } from "./workspace-view";

type CompanyScope = "all" | "leaderOnly" | "employeeOnly";

type LeaderCockpitProps = {
  guideDescription: string;
  progressTitle: string;
  progressDescription: string;
  leaderCount: number;
  confirmedCount: number;
  leaderDistribution: DistributionEntry[];
  companyDistribution: DistributionEntry[];
  activeCompanyScope: CompanyScope;
  onCompanyScopeChange: (scope: CompanyScope) => void;
  evaluatorProgress: Array<{
    evaluatorId: string;
    evaluatorName: string;
    submittedCount: number;
  }>;
  allLeaders: LeaderRow[];
  selectedLeaderId: string | null;
  onSelectLeader: (leaderId: string) => void;
  detailPanel: ReactNode;
};

export function LeaderCockpit({
  guideDescription,
  progressTitle,
  progressDescription,
  leaderCount,
  confirmedCount,
  leaderDistribution,
  companyDistribution,
  activeCompanyScope,
  onCompanyScopeChange,
  evaluatorProgress,
  allLeaders,
  selectedLeaderId,
  onSelectLeader,
  detailPanel,
}: LeaderCockpitProps) {
  const [activeQueueKey, setActiveQueueKey] = useState<"pending" | "awaitingDual" | "all">("awaitingDual");
  const [queuePanelHeight, setQueuePanelHeight] = useState<number | null>(null);
  const detailPanelRef = useRef<HTMLDivElement | null>(null);
  const panelStyle: CSSProperties = {
    background: "var(--cockpit-surface)",
    borderColor: "var(--cockpit-border)",
    boxShadow: "var(--shadow-xs)",
  };
  const queuePanelStyle = {
    ...panelStyle,
    "--queue-panel-height": queuePanelHeight ? `${queuePanelHeight}px` : undefined,
  } as CSSProperties;

  useEffect(() => {
    const node = detailPanelRef.current;
    if (!node) return;

    const syncHeight = () => {
      const nextHeight = Math.ceil(node.getBoundingClientRect().height);
      setQueuePanelHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    syncHeight();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => syncHeight());
    observer.observe(node);
    return () => observer.disconnect();
  }, [selectedLeaderId]);

  const queueGroups = useMemo(() => buildLeaderQueueGroups(allLeaders), [allLeaders]);
  const selectedLeader = allLeaders.find((leader) => leader.id === selectedLeaderId) || null;
  const baseQueueRows = activeQueueKey === "pending"
    ? queueGroups.pending
    : activeQueueKey === "awaitingDual"
      ? queueGroups.awaitingDual
      : queueGroups.all;
  const visibleRows = selectedLeader && !baseQueueRows.some((leader) => leader.id === selectedLeader.id)
    ? [selectedLeader, ...baseQueueRows]
    : baseQueueRows;
  const queueItems = [
    { key: "pending", label: "待生成结果", count: queueGroups.pending.length },
    { key: "awaitingDual", label: "待双人提交", count: queueGroups.awaitingDual.length },
    { key: "all", label: "全部主管", count: queueGroups.all.length },
  ];
  const queueDescription =
    activeQueueKey === "pending"
      ? "优先查看两份问卷都已齐备、系统即将生成结果的主管。"
      : activeQueueKey === "awaitingDual"
        ? "先看仍在等待承霖、邱翔双人提交的主管。"
        : "需要回看时，可以直接从全部主管里搜索定位。";
  const rosterItems: RosterSearchItem[] = visibleRows.map((leader) => ({
    id: leader.id,
    name: leader.name,
    meta: `${leader.department}${leader.jobTitle ? ` · ${leader.jobTitle}` : ""}`,
    status: leader.officialStars != null ? "已形成结果" : leader.bothSubmitted ? "待生成结果" : "待双人提交",
    tone: leader.officialStars != null ? "secondary" : leader.bothSubmitted ? "outline" : "destructive",
  }));
  const pendingCount = queueGroups.pending.length;
  const pendingDualCount = queueGroups.awaitingDual.length;
  const readyCount = queueGroups.pending.filter((leader) => leader.bothSubmitted).length;

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">第一步：主管层双人终评总览</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--cockpit-muted-foreground)]">{guideDescription}</p>
          </div>
          <Badge variant="outline" className="w-fit">
            主管层终评只围绕承霖、邱翔两份问卷
          </Badge>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px] xl:items-start">
          <StarDistributionChart
            title="主管层等级全览"
            description="先看主管层当前正式分布，再决定哪些对象需要优先回看。"
            distribution={leaderDistribution}
          />

          <StarDistributionChart
            title="全公司最终分布"
            description="把主管层结果并回全公司后，再看整体星级分布是否还需要回收口径。"
            distribution={companyDistribution}
          />

          <section className="space-y-4 rounded-[24px] border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">{progressTitle}</p>
                <p className="mt-1 text-xs leading-6 text-[var(--cockpit-muted-foreground)]">{progressDescription}</p>
              </div>
              <Badge variant="outline" className="w-fit">
                双人已齐备 {readyCount} 人
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border px-4 py-3">
                <p className="text-xs text-[var(--cockpit-muted-foreground)]">主管层总人数</p>
                <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{leaderCount} 人</p>
              </div>
              <div className="rounded-2xl border px-4 py-3">
                <p className="text-xs text-[var(--cockpit-muted-foreground)]">已形成结果</p>
                <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{confirmedCount} 人</p>
              </div>
              <div className="rounded-2xl border px-4 py-3">
                <p className="text-xs text-[var(--cockpit-muted-foreground)]">待生成结果</p>
                <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{pendingCount} 人</p>
              </div>
              <div className="rounded-2xl border px-4 py-3">
                <p className="text-xs text-[var(--cockpit-muted-foreground)]">待双人提交</p>
                <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{pendingDualCount} 人</p>
              </div>
            </div>

            <div className="space-y-2">
              {evaluatorProgress.map((item) => (
                <div key={item.evaluatorId} className="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm">
                  <span className="text-[var(--cockpit-foreground)]">{item.evaluatorName}</span>
                  <span className="text-[var(--cockpit-muted-foreground)]">已提交 {item.submittedCount} 份</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant={activeCompanyScope === "all" ? "default" : "outline"} onClick={() => onCompanyScopeChange("all")}>
                全公司
              </Button>
              <Button variant={activeCompanyScope === "leaderOnly" ? "default" : "outline"} onClick={() => onCompanyScopeChange("leaderOnly")}>
                仅主管层
              </Button>
              <Button variant={activeCompanyScope === "employeeOnly" ? "default" : "outline"} onClick={() => onCompanyScopeChange("employeeOnly")}>
                仅非主管层
              </Button>
            </div>
          </section>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(340px,0.38fr)_minmax(0,1fr)] xl:items-start">
        <section
          className="space-y-4 rounded-[28px] border p-5 md:p-6 xl:flex xl:h-[var(--queue-panel-height)] xl:flex-col xl:overflow-hidden"
          style={queuePanelStyle}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">第二步：逐个查看主管</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">{queueDescription}</p>
            </div>
            <Badge variant="outline" className="w-fit">
              共 {allLeaders.length} 人
            </Badge>
          </div>

          <QueueTabs items={queueItems} activeKey={activeQueueKey} onChange={(key) => setActiveQueueKey(key as "pending" | "awaitingDual" | "all")} />

          {selectedLeader && !baseQueueRows.some((leader) => leader.id === selectedLeader.id) ? (
            <div className="rounded-2xl border border-dashed px-4 py-3 text-sm text-[var(--cockpit-muted-foreground)]">
              当前查看的是 {selectedLeader.name}。Ta 已不在这个队列里，但会继续保留在右侧，方便你回看。
            </div>
          ) : null}

          <RosterSearchList
            searchPlaceholder="搜索主管"
            emptyText="没有匹配的主管"
            selectedId={selectedLeaderId}
            items={rosterItems}
            onSelect={onSelectLeader}
          />
        </section>

        <div ref={detailPanelRef}>{detailPanel}</div>
      </div>
    </div>
  );
}
