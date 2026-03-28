"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DistributionDrawer } from "./distribution-drawer";
import { QueueTabs } from "./queue-tabs";
import { RosterSearchList, type RosterSearchItem } from "./roster-search-list";
import { ScoreBandChart } from "./score-band-chart";
import { StarDistributionChart } from "./star-distribution-chart";
import type { DistributionEntry, EmployeeRow } from "./types";
import { buildEmployeeQueueGroups, type EmployeePriorityCard, type ScoreBandBucket } from "./workspace-view";

type EmployeeCockpitProps = {
  guideDescription: string;
  priorityBoardTitle: string;
  priorityBoardDescription: string;
  companyCount: number;
  initialEvalSubmissionRate: number;
  officialCompletionRate: number;
  pendingOfficialCount: number;
  employeeDistribution: DistributionEntry[];
  scoreBandBuckets: ScoreBandBucket[];
  priorityCards: EmployeePriorityCard[];
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
  employeeDistribution,
  scoreBandBuckets,
  allEmployees,
  selectedEmployeeId,
  onSelectEmployee,
  detailPanel,
}: EmployeeCockpitProps) {
  const [activeQueueKey, setActiveQueueKey] = useState<"pending" | "disagreement" | "all">("pending");
  const panelStyle: CSSProperties = {
    background: "var(--cockpit-surface)",
    borderColor: "var(--cockpit-border)",
    boxShadow: "var(--shadow-xs)",
  };

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
    { key: "pending", label: "待拍板", count: queueGroups.pending.length },
    { key: "disagreement", label: "有分歧", count: queueGroups.disagreement.length },
    { key: "all", label: "全部员工", count: queueGroups.all.length },
  ];
  const rosterItems: RosterSearchItem[] = visibleRows.map((employee) => ({
    id: employee.id,
    name: employee.name,
    meta: `${employee.department}${employee.jobTitle ? ` · ${employee.jobTitle}` : ""}`,
    status: employee.officialStars == null ? "待拍板" : employee.summaryStats.overrideCount > 0 ? "有分歧" : "已确认",
    tone: employee.officialStars == null ? "outline" : employee.summaryStats.overrideCount > 0 ? "destructive" : "secondary",
  }));
  const queueDescription =
    activeQueueKey === "pending"
      ? "优先处理还没有正式拍板的人。"
      : activeQueueKey === "disagreement"
        ? "先看存在改星意见的人。"
        : "需要回看时，可以直接从全部员工里搜索定位。";

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cockpit-muted-foreground)]">Employee Cockpit</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm leading-7 text-[var(--cockpit-foreground)]">{guideDescription}</p>
          <Badge variant="outline" className="w-fit">
            左侧选人，右侧只处理当前这一个人
          </Badge>
        </div>
      </section>

      <DistributionDrawer
        title="整体分布"
        description={`共 ${companyCount} 人 · 初评提交率 ${initialEvalSubmissionRate}% · 已拍板 ${officialCompletionRate}% · 待确认 ${pendingOfficialCount} 人`}
      >
        <ScoreBandChart
          title="分数带"
          description="按普通员工当前初评加权分分桶，帮助回到整体视角。"
          bands={scoreBandBuckets}
        />
        <StarDistributionChart
          title="当前星级分布"
          description="已确认员工按官方结果统计，未确认员工仍按参考星级进入分布。"
          distribution={employeeDistribution}
        />
      </DistributionDrawer>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
        <section className="space-y-4 rounded-[28px] border p-5 md:p-6" style={panelStyle}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">处理队列</h2>
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

        {detailPanel}
      </div>
    </div>
  );
}
