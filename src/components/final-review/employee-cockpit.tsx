"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DepartmentDistributionBoard } from "./department-distribution-board";
import { QueueTabs } from "./queue-tabs";
import { RosterSearchList, type RosterSearchItem } from "./roster-search-list";
import { ScoreBandChart } from "./score-band-chart";
import { StarDistributionChart } from "./star-distribution-chart";
import type { DistributionEntry, EmployeeRow } from "./types";
import { buildEmployeeQueueGroups, type ScoreBandBucket } from "./workspace-view";

type EmployeeCockpitProps = {
  guideDescription: string;
  companyCount: number;
  initialEvalSubmissionRate: number;
  officialCompletionRate: number;
  pendingOfficialCount: number;
  companyDistribution: DistributionEntry[];
  employeeDistribution: DistributionEntry[];
  departmentDistributions: Array<{
    department: string;
    total: number;
    distribution: DistributionEntry[];
  }>;
  scoreBandBuckets: ScoreBandBucket[];
  allEmployees: EmployeeRow[];
  selectedEmployeeId: string | null;
  onSelectEmployee: (employeeId: string) => void;
  detailPanel: ReactNode;
};

export function EmployeeCockpit({
  guideDescription,
  companyCount,
  initialEvalSubmissionRate,
  officialCompletionRate,
  pendingOfficialCount,
  companyDistribution,
  employeeDistribution,
  departmentDistributions,
  scoreBandBuckets,
  allEmployees,
  selectedEmployeeId,
  onSelectEmployee,
  detailPanel,
}: EmployeeCockpitProps) {
  const [activeQueueKey, setActiveQueueKey] = useState<"pending" | "disagreement" | "all">("pending");
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
  }, [selectedEmployeeId]);

  const queueGroups = useMemo(() => buildEmployeeQueueGroups(allEmployees), [allEmployees]);
  const selectedEmployee = allEmployees.find((employee) => employee.id === selectedEmployeeId) || null;
  const baseQueueRows = activeQueueKey === "pending"
    ? queueGroups.pending
    : activeQueueKey === "disagreement"
      ? queueGroups.disagreement
      : queueGroups.all;
  const visibleRows = selectedEmployee && !baseQueueRows.some((employee) => employee.id === selectedEmployee.id)
    ? [selectedEmployee, ...baseQueueRows]
    : baseQueueRows;
  const queueItems = [
    { key: "pending", label: "待双人校准", count: queueGroups.pending.length },
    { key: "disagreement", label: "两人不一致", count: queueGroups.disagreement.length },
    { key: "all", label: "全部员工", count: queueGroups.all.length },
  ];
  const rosterItems: RosterSearchItem[] = visibleRows.map((employee) => ({
    id: employee.id,
    name: employee.name,
    meta: `${employee.department}${employee.jobTitle ? ` · ${employee.jobTitle}` : ""}`,
    status: employee.summaryStats.disagreementCount > 0 ? "两人不一致" : employee.officialStars == null ? "待双人校准" : "已形成结果",
    tone: employee.summaryStats.disagreementCount > 0 ? "destructive" : employee.officialStars == null ? "outline" : "secondary",
  }));
  const queueDescription =
    activeQueueKey === "pending"
      ? "优先处理承霖、邱翔还没有都完成校准的人。"
      : activeQueueKey === "disagreement"
        ? "先看两位校准人当前结论不一致的人。"
        : "需要回看时，可以直接从全部员工里搜索定位。";

  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">第一步：公司分布总览</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--cockpit-muted-foreground)]">{guideDescription}</p>
            </div>
            <Badge variant="outline" className="w-fit">
              普通员工终评只围绕承霖、邱翔收口
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border px-4 py-3">
              <p className="text-xs text-[var(--cockpit-muted-foreground)]">公司当前绩效分布全览</p>
              <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{companyCount} 人</p>
            </div>
            <div className="rounded-2xl border px-4 py-3">
              <p className="text-xs text-[var(--cockpit-muted-foreground)]">绩效初评提交率</p>
              <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{initialEvalSubmissionRate}%</p>
            </div>
            <div className="rounded-2xl border px-4 py-3">
              <p className="text-xs text-[var(--cockpit-muted-foreground)]">员工层已形成结果</p>
              <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{officialCompletionRate}%</p>
            </div>
            <div className="rounded-2xl border px-4 py-3">
              <p className="text-xs text-[var(--cockpit-muted-foreground)]">待双人一致</p>
              <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{pendingOfficialCount} 人</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <StarDistributionChart
              title="公司当前绩效分布"
              description="先看各星级当前人数，再决定是否优先处理偏离建议分布的档位。"
              distribution={companyDistribution}
            />
            <div className="space-y-3 rounded-[24px] border p-4">
              <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">异常超出 / 不足人数</p>
              {companyDistribution.map((item) => (
                <div key={`company-risk:${item.stars}`} className="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm">
                  <span className="text-[var(--cockpit-foreground)]">{item.stars}星</span>
                  <span className={item.exceeded ? "text-[color:#b45309]" : "text-[var(--cockpit-muted-foreground)]"}>
                    {item.exceeded ? `${item.stars === 3 ? "不足" : "超出"} ${item.delta} 人` : "符合建议分布"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ScoreBandChart
          title="分数带"
          description="按普通员工当前初评加权分分桶，帮助快速识别需要重点翻看的区间。"
          bands={scoreBandBuckets}
        />
      </section>

      <DepartmentDistributionBoard departments={departmentDistributions} />

      <div className="grid gap-5 xl:grid-cols-[minmax(340px,0.38fr)_minmax(0,1fr)] xl:items-start">
        <section
          className="space-y-4 rounded-[28px] border p-5 md:p-6 xl:flex xl:h-[var(--queue-panel-height)] xl:flex-col xl:overflow-hidden"
          style={queuePanelStyle}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">第三步：逐一校准</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">{queueDescription}</p>
            </div>
            <Badge variant="outline" className="w-fit">
              共 {allEmployees.length} 人
            </Badge>
          </div>

          <QueueTabs items={queueItems} activeKey={activeQueueKey} onChange={(key) => setActiveQueueKey(key as "pending" | "disagreement" | "all")} />

          {selectedEmployee && !baseQueueRows.some((employee) => employee.id === selectedEmployee.id) ? (
            <div className="rounded-2xl border border-dashed px-4 py-3 text-sm text-[var(--cockpit-muted-foreground)]">
              当前查看的是 {selectedEmployee.name}。Ta 已不在这个队列里，但会继续保留在右侧，方便你回看。
            </div>
          ) : null}

          <RosterSearchList
            searchPlaceholder="搜索员工"
            emptyText="没有匹配的员工"
            selectedId={selectedEmployeeId}
            items={rosterItems}
            onSelect={onSelectEmployee}
          />
        </section>

        <div ref={detailPanelRef}>{detailPanel}</div>
      </div>

      <section className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
        <StarDistributionChart
          title="员工层实时分布"
          description="员工层已一致的按官方结果统计，尚未一致的继续按参考星级进入临时分布。"
          distribution={employeeDistribution}
        />
      </section>
    </div>
  );
}
