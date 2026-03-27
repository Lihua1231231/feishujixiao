"use client";

import type { CSSProperties, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ScoreBandChart } from "./score-band-chart";
import { StarDistributionChart } from "./star-distribution-chart";
import type { DistributionEntry, EmployeeRow } from "./types";
import type { EmployeePriorityCard, ScoreBandBucket } from "./workspace-view";

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
  selectedEmployeeId: string | null;
  onSelectEmployee: (employeeId: string) => void;
  detailPanel: ReactNode;
};

const accentClasses: Record<EmployeePriorityCard["accent"], string> = {
  slate: "border-slate-200 bg-slate-50/70",
  amber: "border-amber-200 bg-amber-50/80",
  rose: "border-rose-200 bg-rose-50/80",
  blue: "border-sky-200 bg-sky-50/80",
  violet: "border-violet-200 bg-violet-50/80",
};

function EmployeeQueueButton({
  employee,
  selected,
  onSelect,
}: {
  employee: EmployeeRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
        selected
          ? "border-[color:var(--cockpit-accent-strong)] bg-[color:var(--cockpit-accent)]/25"
          : "border-border/60 bg-white/80 hover:border-[color:var(--cockpit-accent)]"
      }`}
      aria-pressed={selected}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--cockpit-foreground)]">{employee.name}</p>
          <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">{employee.department}</p>
        </div>
        <Badge variant={employee.officialConfirmedAt ? "secondary" : "outline"}>
          {employee.officialConfirmedAt ? "已确认" : "待拍板"}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--cockpit-muted-foreground)]">
        <span>参考 {employee.referenceStars != null ? `${employee.referenceStars} 星` : "—"}</span>
        <span>加权分 {employee.weightedScore?.toFixed(1) ?? "—"}</span>
        {employee.anomalyTags[0] ? <span>{employee.anomalyTags[0]}</span> : null}
      </div>
    </button>
  );
}

export function EmployeeCockpit({
  guideDescription,
  priorityBoardTitle,
  priorityBoardDescription,
  companyCount,
  initialEvalSubmissionRate,
  officialCompletionRate,
  pendingOfficialCount,
  employeeDistribution,
  scoreBandBuckets,
  priorityCards,
  selectedEmployeeId,
  onSelectEmployee,
  detailPanel,
}: EmployeeCockpitProps) {
  const panelStyle: CSSProperties = {
    background: "var(--cockpit-surface)",
    borderColor: "var(--cockpit-border)",
    boxShadow: "var(--shadow-xs)",
  };

  const metricCards = [
    { title: "公司当前人数", value: `${companyCount}`, description: "本轮参与绩效终评的员工总人数" },
    { title: "绩效初评提交率", value: `${initialEvalSubmissionRate}%`, description: "普通员工初评问卷当前已提交的比例" },
    { title: "当前官方终评完成率", value: `${officialCompletionRate}%`, description: "已经被最终确认人正式拍板的比例" },
    { title: "待最终确认人数", value: `${pendingOfficialCount}`, description: "还没有正式拍板的普通员工人数" },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,420px)] xl:items-start">
      <div className="space-y-5">
        <section className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cockpit-muted-foreground)]">Employee Cockpit</p>
          <p className="mt-3 text-sm leading-7 text-[var(--cockpit-foreground)]">{guideDescription}</p>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((metric) => (
            <section key={metric.title} className="rounded-[24px] border p-5" style={panelStyle}>
              <p className="text-xs font-medium text-[var(--cockpit-muted-foreground)]">{metric.title}</p>
              <p className="mt-3 text-2xl font-semibold text-[var(--cockpit-foreground)]">{metric.value}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--cockpit-muted-foreground)]">{metric.description}</p>
            </section>
          ))}
        </div>

        <div className="grid gap-4 2xl:grid-cols-2">
          <ScoreBandChart
            title="分数带"
            description="按普通员工当前初评加权分分桶，先看哪些分段的人数最集中。"
            bands={scoreBandBuckets}
          />
          <StarDistributionChart
            title="当前星级分布"
            description="已确认员工按官方结果统计，未确认员工仍按参考星级进入分布。"
            distribution={employeeDistribution}
          />
        </div>

        <section className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">{priorityBoardTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">{priorityBoardDescription}</p>
            </div>
            <Badge variant="outline" className="w-fit">
              左侧选人，右侧拍板
            </Badge>
          </div>

          <div className="mt-5 grid gap-4 2xl:grid-cols-2">
            {priorityCards.map((card) => (
              <section key={card.key} className={`rounded-[24px] border p-4 ${accentClasses[card.accent]}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">{card.title}</p>
                    <p className="mt-1 text-sm text-[var(--cockpit-foreground)]">{card.summary}</p>
                  </div>
                  <span className="rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-[var(--cockpit-foreground)]">{card.count}</span>
                </div>
                <p className="mt-3 text-xs leading-6 text-[var(--cockpit-muted-foreground)]">{card.description}</p>

                {card.rows.length ? (
                  <div className="mt-4 max-h-[280px] space-y-2 overflow-auto pr-1">
                    {card.rows.map((employee) => (
                      <EmployeeQueueButton
                        key={`${card.key}:${employee.id}`}
                        employee={employee}
                        selected={employee.id === selectedEmployeeId}
                        onSelect={() => onSelectEmployee(employee.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed px-4 py-6 text-sm text-[var(--cockpit-muted-foreground)]">
                    当前这个队列里还没有员工，可以先从其他队列继续处理。
                  </div>
                )}
              </section>
            ))}
          </div>
        </section>
      </div>

      <div>{detailPanel}</div>
    </div>
  );
}
