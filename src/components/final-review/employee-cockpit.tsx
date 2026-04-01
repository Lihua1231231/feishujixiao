"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DepartmentDistributionBoard } from "./department-distribution-board";
import { QueueTabs } from "./queue-tabs";
import { RosterSearchList, type RosterSearchItem } from "./roster-search-list";
import type { DistributionEntry, EmployeeRow } from "./types";
import { buildEmployeeQueueGroups } from "./workspace-view";

type EmployeeCockpitProps = {
  departmentDistributions: Array<{
    department: string;
    total: number;
    distribution: DistributionEntry[];
  }>;
  allEmployees: EmployeeRow[];
  selectedEmployeeId: string | null;
  onSelectEmployee: (employeeId: string) => void;
  detailPanel: ReactNode;
};

export function EmployeeCockpit({
  departmentDistributions,
  allEmployees,
  selectedEmployeeId,
  onSelectEmployee,
  detailPanel,
}: EmployeeCockpitProps) {
  const [activeQueueKey, setActiveQueueKey] = useState<"disagreement" | "all">("disagreement");
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
  const baseQueueRows = activeQueueKey === "disagreement"
    ? queueGroups.disagreement
    : queueGroups.all;
  const visibleRows = selectedEmployee && !baseQueueRows.some((employee) => employee.id === selectedEmployee.id)
    ? [selectedEmployee, ...baseQueueRows]
    : baseQueueRows;
  const queueItems = [
    { key: "disagreement", label: "发生校准", count: queueGroups.disagreement.length },
    { key: "all", label: "全部员工", count: queueGroups.all.length },
  ];
  const rosterItems: RosterSearchItem[] = visibleRows.map((employee) => ({
    id: employee.id,
    name: employee.name,
    meta: `${employee.department}${employee.jobTitle ? ` · ${employee.jobTitle}` : ""}`,
    detail: `绩效初评等级（加权） ${employee.referenceStars != null ? `${employee.referenceStars}星` : "—"}`,
    status: employee.summaryStats.disagreementCount > 0 ? "发生校准" : employee.officialStars == null ? "待双人校准" : "终评意见一致",
    tone: employee.summaryStats.disagreementCount > 0 ? "destructive" : employee.officialStars == null ? "outline" : "secondary",
  }));
  const queueDescription =
    activeQueueKey === "disagreement"
      ? "先看发生校准的人。"
      : "需要回看时，可以直接搜索定位。";

  return (
    <div className="space-y-5">
      <DepartmentDistributionBoard departments={departmentDistributions} />

      <div className="grid gap-5 xl:grid-cols-[minmax(340px,0.38fr)_minmax(0,1fr)] xl:items-start">
        <section
          className="space-y-4 rounded-[28px] border p-5 md:p-6 xl:flex xl:h-[var(--queue-panel-height)] xl:flex-col xl:overflow-hidden"
          style={queuePanelStyle}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">逐一校准</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">{queueDescription}</p>
            </div>
            <Badge variant="outline" className="w-fit">
              共 {allEmployees.length} 人
            </Badge>
          </div>

          <QueueTabs items={queueItems} activeKey={activeQueueKey} onChange={(key) => setActiveQueueKey(key as "disagreement" | "all")} />

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
    </div>
  );
}
