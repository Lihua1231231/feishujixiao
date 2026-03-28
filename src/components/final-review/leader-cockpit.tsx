"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QueueTabs } from "./queue-tabs";
import { RosterSearchList, type RosterSearchItem } from "./roster-search-list";
import { StarDistributionChart } from "./star-distribution-chart";
import type { DistributionEntry, LeaderRow } from "./types";
import { buildLeaderQueueGroups, type LeaderPriorityCard, type LeaderSubmissionSummary } from "./workspace-view";

type CompanyScope = "all" | "leaderOnly" | "employeeOnly";

type LeaderCockpitProps = {
  guideDescription: string;
  progressTitle: string;
  progressDescription: string;
  rosterTitle: string;
  rosterDescription: string;
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
  priorityCards: LeaderPriorityCard[];
  submissionSummary: LeaderSubmissionSummary[];
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
  const [activeQueueKey, setActiveQueueKey] = useState<"pending" | "awaitingDual" | "all">("pending");
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
    { key: "pending", label: "待拍板", count: queueGroups.pending.length },
    { key: "awaitingDual", label: "待双人齐备", count: queueGroups.awaitingDual.length },
    { key: "all", label: "全部主管", count: queueGroups.all.length },
  ];
  const queueDescription =
    activeQueueKey === "pending"
      ? "优先处理已具备条件、还没正式拍板的主管。"
      : activeQueueKey === "awaitingDual"
        ? "先看仍在等待双人问卷齐备的主管。"
        : "需要回看时，可以直接从全部主管里搜索定位。";
  const rosterItems: RosterSearchItem[] = visibleRows.map((leader) => ({
    id: leader.id,
    name: leader.name,
    meta: `${leader.department}${leader.jobTitle ? ` · ${leader.jobTitle}` : ""}`,
    status: leader.officialStars != null ? "已生成结果" : leader.bothSubmitted ? "待系统生成" : "待双人齐备",
    tone: leader.officialStars != null ? "secondary" : leader.bothSubmitted ? "outline" : "destructive",
  }));
  const pendingCount = queueGroups.pending.length;
  const pendingDualCount = queueGroups.awaitingDual.length;
  const readyCount = queueGroups.pending.filter((leader) => leader.bothSubmitted).length;

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cockpit-muted-foreground)]">Leader Cockpit</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm leading-7 text-[var(--cockpit-foreground)]">{guideDescription}</p>
          <Badge variant="outline" className="w-fit">
            左侧选主管，右侧只处理当前这一个人
          </Badge>
        </div>
      </section>

      <section className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <StarDistributionChart
            title="主管层正式分布"
            description="先看主管层当前正式分布，再决定哪些对象需要优先回看。"
            distribution={leaderDistribution}
          />

          <div className="space-y-4">
            <section className="rounded-[24px] border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">{progressTitle}</p>
                  <p className="mt-1 text-xs leading-6 text-[var(--cockpit-muted-foreground)]">{progressDescription}</p>
                </div>
                <Badge variant="outline" className="w-fit">
                  双人已齐备 {readyCount} 人
                </Badge>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border px-4 py-3">
                  <p className="text-xs text-[var(--cockpit-muted-foreground)]">主管层总人数</p>
                  <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{leaderCount} 人</p>
                </div>
                <div className="rounded-2xl border px-4 py-3">
                  <p className="text-xs text-[var(--cockpit-muted-foreground)]">已确认</p>
                  <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{confirmedCount} 人</p>
                </div>
                <div className="rounded-2xl border px-4 py-3">
                  <p className="text-xs text-[var(--cockpit-muted-foreground)]">待系统生成</p>
                  <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{pendingCount} 人</p>
                </div>
                <div className="rounded-2xl border px-4 py-3">
                  <p className="text-xs text-[var(--cockpit-muted-foreground)]">待双人齐备</p>
                  <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{pendingDualCount} 人</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {evaluatorProgress.map((item) => (
                  <div key={item.evaluatorId} className="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm">
                    <span className="text-[var(--cockpit-foreground)]">{item.evaluatorName}</span>
                    <span className="text-[var(--cockpit-muted-foreground)]">已提交 {item.submittedCount} 份</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border p-4">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">全公司分布对照</p>
                  <p className="mt-1 text-xs leading-6 text-[var(--cockpit-muted-foreground)]">支持切换整体范围，作为主管层结果的参考背景。</p>
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
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-5">
                {companyDistribution.map((item) => (
                  <div key={`${activeCompanyScope}:${item.stars}`} className="rounded-2xl border px-3 py-3">
                    <div className="flex items-center justify-between gap-3 text-xs text-[var(--cockpit-muted-foreground)]">
                      <span>{item.stars}星</span>
                      <span>{item.pct.toFixed(0)}%</span>
                    </div>
                    <p className="mt-3 text-xl font-semibold text-[var(--cockpit-foreground)]" title={item.names.join("、")}>
                      {item.count}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(340px,0.38fr)_minmax(0,1fr)] xl:items-start">
        <section
          className="space-y-4 rounded-[28px] border p-5 md:p-6 xl:flex xl:h-[var(--queue-panel-height)] xl:flex-col xl:overflow-hidden"
          style={queuePanelStyle}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">处理队列</h2>
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
