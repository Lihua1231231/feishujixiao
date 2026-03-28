"use client";

import type { CSSProperties, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RosterSearchList, type RosterSearchItem } from "./roster-search-list";
import { StarDistributionChart } from "./star-distribution-chart";
import type { DistributionEntry, LeaderRow } from "./types";
import type { LeaderPriorityCard, LeaderSubmissionSummary } from "./workspace-view";

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

const accentClasses: Record<LeaderPriorityCard["accent"], string> = {
  slate: "border-slate-200 bg-slate-50/70",
  amber: "border-amber-200 bg-amber-50/80",
  emerald: "border-emerald-200 bg-emerald-50/80",
};

function LeaderRosterButton({
  leader,
  summary,
  selected,
  onSelect,
}: {
  leader: LeaderRow;
  summary: LeaderSubmissionSummary | undefined;
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
          <p className="text-sm font-medium text-[var(--cockpit-foreground)]">{leader.name}</p>
          <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">{leader.department}</p>
        </div>
        <Badge variant={leader.officialStars == null ? "outline" : "secondary"}>
          {leader.officialStars == null ? "待拍板" : "已拍板"}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--cockpit-muted-foreground)]">
        <span>{summary?.bothSubmitted ? "双人已齐备" : `${summary?.submittedCount ?? 0}/2 已提交`}</span>
        <span>{leader.officialStars != null ? `官方 ${leader.officialStars} 星` : "等待官方结果"}</span>
        {leader.jobTitle ? <span>{leader.jobTitle}</span> : null}
      </div>
    </button>
  );
}

export function LeaderCockpit({
  guideDescription,
  progressTitle,
  progressDescription,
  rosterTitle,
  rosterDescription,
  leaderCount,
  confirmedCount,
  leaderDistribution,
  companyDistribution,
  activeCompanyScope,
  onCompanyScopeChange,
  evaluatorProgress,
  priorityCards,
  submissionSummary,
  allLeaders,
  selectedLeaderId,
  onSelectLeader,
  detailPanel,
}: LeaderCockpitProps) {
  const panelStyle: CSSProperties = {
    background: "var(--cockpit-surface)",
    borderColor: "var(--cockpit-border)",
    boxShadow: "var(--shadow-xs)",
  };

  const readyCount = priorityCards.find((card) => card.key === "ready")?.count ?? 0;
  const pendingCount = priorityCards.find((card) => card.key === "pending")?.count ?? 0;
  const pendingDualCount = priorityCards.find((card) => card.key === "awaitingDualSubmission")?.count ?? 0;
  const summaryByLeader = new Map(submissionSummary.map((item) => [item.id, item]));
  const rosterItems: RosterSearchItem[] = allLeaders.map((leader) => ({
    id: leader.id,
    name: leader.name,
    meta: `${leader.department}${leader.jobTitle ? ` · ${leader.jobTitle}` : ""}`,
    status: leader.officialStars != null ? "已拍板" : leader.bothSubmitted ? "待拍板" : "待双人齐备",
    tone: leader.officialStars != null ? "secondary" : leader.bothSubmitted ? "outline" : "destructive",
  }));

  const metricCards = [
    { title: "主管层总人数", value: `${leaderCount}`, description: "当前纳入主管层双人终评的对象人数" },
    { title: "主管层已拍板", value: `${confirmedCount}`, description: "已经被最终确认人正式拍板的主管人数" },
    { title: "待拍板", value: `${pendingCount}`, description: "双人问卷未必都齐，但官方结果仍未落定的主管人数" },
    { title: "待双人齐备", value: `${pendingDualCount}`, description: "至少还有一位填写人没有提交主管层问卷" },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,440px)] xl:items-start">
      <div className="space-y-5">
        <section className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cockpit-muted-foreground)]">Leader Cockpit</p>
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
          <StarDistributionChart
            title="主管层正式分布"
            description="按主管层当前正式结果统计，先看整体星级分布是否稳定。"
            distribution={leaderDistribution}
          />

          <section className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">全公司绩效等级分布对照</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">支持切换全公司、仅主管层、仅非主管层，方便对照主管层结果的上下文。</p>
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

            <div className="mt-5 grid gap-3 sm:grid-cols-5">
              {companyDistribution.map((item) => (
                <div key={`${activeCompanyScope}:${item.stars}`} className="rounded-2xl border px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-xs text-[var(--cockpit-muted-foreground)]">
                    <span>{item.stars}星</span>
                    <span>{item.pct.toFixed(0)}%</span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-[var(--cockpit-foreground)]" title={item.names.join("、")}>
                    {item.count}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">{progressTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">{progressDescription}</p>
            </div>
            <Badge variant="outline" className="w-fit">
              可拍板 {readyCount} 人
            </Badge>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {evaluatorProgress.map((item) => (
              <section key={item.evaluatorId} className="rounded-[24px] border px-4 py-4">
                <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">{item.evaluatorName}</p>
                <p className="mt-3 text-2xl font-semibold text-[var(--cockpit-foreground)]">{item.submittedCount}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--cockpit-muted-foreground)]">{item.evaluatorName} 已提交的主管层问卷数量</p>
              </section>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">{rosterTitle}</h2>
              <p className="text-sm leading-6 text-[var(--cockpit-muted-foreground)]">{rosterDescription}</p>
            </div>
            <Badge variant="outline" className="w-fit">
              共 {allLeaders.length} 人
            </Badge>
          </div>

          <div className="mt-5 grid gap-4 2xl:grid-cols-3">
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
                    {card.rows.map((leader) => (
                      <LeaderRosterButton
                        key={`${card.key}:${leader.id}`}
                        leader={leader}
                        summary={summaryByLeader.get(leader.id)}
                        selected={leader.id === selectedLeaderId}
                        onSelect={() => onSelectLeader(leader.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed px-4 py-6 text-sm text-[var(--cockpit-muted-foreground)]">
                    当前这个队列里还没有主管，可以先从其他名单继续处理。
                  </div>
                )}
              </section>
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-4">
        <section className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">{rosterTitle}</h2>
              <p className="text-sm leading-6 text-[var(--cockpit-muted-foreground)]">
                除了优先队列，也可以直接搜索主管，快速回到任意一位主管的总结卡片。
              </p>
            </div>
            <Badge variant="outline" className="w-fit">
              共 {allLeaders.length} 人
            </Badge>
          </div>

          <div className="mt-5">
            <RosterSearchList
              searchPlaceholder="搜索主管"
              emptyText="没有匹配的主管"
              selectedId={selectedLeaderId}
              items={rosterItems}
              onSelect={onSelectLeader}
            />
          </div>
        </section>

        {detailPanel}
      </div>
    </div>
  );
}
