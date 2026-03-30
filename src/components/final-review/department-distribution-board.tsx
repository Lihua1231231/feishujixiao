"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DistributionEntry } from "./types";

type DepartmentDistributionBoardProps = {
  departments: Array<{
    department: string;
    total: number;
    distribution: DistributionEntry[];
  }>;
};

const STAR_RULES = [
  { stars: 1, ratio: 0.05, summary: "建议上限 5%" },
  { stars: 2, ratio: 0.15, summary: "建议上限 15%" },
  { stars: 3, ratio: 0.5, summary: "建议下限 50%" },
  { stars: 4, ratio: 0.2, summary: "建议上限 20%" },
  { stars: 5, ratio: 0.1, summary: "建议上限 10%" },
] as const;

function buildEmptyDistribution(): DistributionEntry[] {
  return STAR_RULES.map((rule) => ({
    stars: rule.stars,
    count: 0,
    pct: 0,
    exceeded: false,
    delta: 0,
    names: [],
  }));
}

function pickDefaultStar(
  summaries: Array<
    DistributionEntry & {
      suggestedCount: number;
      summary: string;
      deltaCount: number;
    }
  >,
) {
  return summaries.reduce((best, current) => {
    const bestWeight = Math.abs(best.deltaCount) * 100 + best.count;
    const currentWeight = Math.abs(current.deltaCount) * 100 + current.count;
    return currentWeight > bestWeight ? current : best;
  }).stars;
}

export function DepartmentDistributionBoard({ departments }: DepartmentDistributionBoardProps) {
  const [activeDepartmentKey, setActiveDepartmentKey] = useState<"all" | string>("all");
  const [activeStarOverride, setActiveStarOverride] = useState<number | null>(null);
  const allDepartmentDistribution = useMemo(() => {
    const merged = buildEmptyDistribution();

    for (const department of departments) {
      for (const bucket of department.distribution) {
        const target = merged.find((item) => item.stars === bucket.stars);
        if (!target) continue;
        target.count += bucket.count;
        target.names = [...target.names, ...bucket.names];
      }
    }

    return merged;
  }, [departments]);

  const totalEmployees = departments.reduce((sum, item) => sum + item.total, 0);
  const selectedDepartment = departments.find((item) => item.department === activeDepartmentKey) ?? null;
  const selectedDistribution = selectedDepartment?.distribution ?? allDepartmentDistribution;
  const selectedTotal = selectedDepartment?.total ?? totalEmployees;
  const selectedScopeLabel = selectedDepartment?.department ?? "全公司";

  const selectedSummaries = useMemo(
    () =>
      STAR_RULES.map((rule) => {
        const actual = selectedDistribution.find((item) => item.stars === rule.stars) ?? {
          stars: rule.stars,
          count: 0,
          pct: 0,
          exceeded: false,
          delta: 0,
          names: [],
        };
        const suggestedCount = Math.round(selectedTotal * rule.ratio);
        return {
          ...actual,
          suggestedCount,
          summary: rule.summary,
          deltaCount: actual.count - suggestedCount,
        };
      }),
    [selectedDistribution, selectedTotal],
  );

  const dominantBucket = selectedSummaries.reduce(
    (best, current) => (current.count > best.count ? current : best),
    selectedSummaries[0] ?? {
      stars: 1,
      count: 0,
      pct: 0,
      exceeded: false,
      delta: 0,
      names: [],
      suggestedCount: 0,
      summary: "",
      deltaCount: 0,
    },
  );

  const tallestValue = Math.max(
    1,
    ...selectedSummaries.map((item) => Math.max(item.count, item.suggestedCount)),
  );
  const defaultStar = pickDefaultStar(selectedSummaries);
  const activeStar = activeStarOverride ?? defaultStar;
  const selectedBucket =
    selectedSummaries.find((item) => item.stars === activeStar) ?? selectedSummaries[0];
  const chartHeight = 196;
  const polylinePoints = selectedSummaries
    .map((item, index) => {
      const x = 10 + index * 20;
      const y = chartHeight - (item.suggestedCount / tallestValue) * chartHeight;
      return `${x},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <Card className="rounded-[28px] border shadow-none">
      <CardHeader>
        <CardTitle className="text-lg text-[var(--cockpit-foreground)]">第二步：按团队分布</CardTitle>
        <p className="text-sm leading-6 text-[var(--cockpit-muted-foreground)]">
          默认先看全公司。点击部门卡片后，下方同一张图会切到该部门视角；这样能快速看全局，也不会把页面拉得很长。
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          <button
            type="button"
            onClick={() => {
              setActiveDepartmentKey("all");
              setActiveStarOverride(null);
            }}
            className={
              activeDepartmentKey === "all"
                ? "min-w-[148px] rounded-[22px] border border-[color:#231f1a] bg-[color:#231f1a] px-4 py-3 text-left text-white shadow-sm"
                : "min-w-[148px] rounded-[22px] border bg-white px-4 py-3 text-left text-[var(--cockpit-foreground)] shadow-none transition-colors hover:bg-[color:rgba(191,127,65,0.06)]"
            }
          >
            <p className="text-sm font-semibold">全公司</p>
            <p className={activeDepartmentKey === "all" ? "mt-1 text-xs text-white/80" : "mt-1 text-xs text-[var(--cockpit-muted-foreground)]"}>
              {totalEmployees} 人
            </p>
          </button>

          {departments.map((department) => {
            const dominant = department.distribution.reduce(
              (best, current) => (current.count > best.count ? current : best),
              department.distribution[0] ?? {
                stars: 1,
                count: 0,
                pct: 0,
                exceeded: false,
                delta: 0,
                names: [],
              },
            );
            const active = activeDepartmentKey === department.department;

            return (
              <button
                key={department.department}
                type="button"
                onClick={() => {
                  setActiveDepartmentKey(department.department);
                  setActiveStarOverride(null);
                }}
                className={
                  active
                    ? "min-w-[148px] rounded-[22px] border border-[color:#a56a2d] bg-[color:#f8ecdf] px-4 py-3 text-left shadow-sm"
                    : "min-w-[148px] rounded-[22px] border bg-white px-4 py-3 text-left shadow-none transition-colors hover:bg-[color:rgba(191,127,65,0.06)]"
                }
              >
                <p className="truncate text-sm font-semibold text-[var(--cockpit-foreground)]">{department.department}</p>
                <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">{department.total} 人</p>
                <p className="mt-2 text-xs text-[var(--cockpit-muted-foreground)]">
                  主要集中在 {dominant.count > 0 ? `${dominant.stars}星` : "暂无分布"}
                </p>
              </button>
            );
          })}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <section className="rounded-[24px] border p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">当前视角</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--cockpit-foreground)]">{selectedScopeLabel}</h3>
                <p className="mt-2 text-sm text-[var(--cockpit-muted-foreground)]">
                  共 {selectedTotal} 人，当前最集中的档位是 {dominantBucket.count > 0 ? `${dominantBucket.stars}星` : "暂无"}
                </p>
              </div>

              <div className="rounded-[18px] border bg-[color:rgba(191,127,65,0.05)] px-4 py-3 text-sm text-[var(--cockpit-muted-foreground)]">
                悬停柱体可看具体名单
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border bg-[linear-gradient(180deg,rgba(249,244,237,0.92),rgba(255,255,255,0.98))] px-4 py-5">
              <div className="relative">
                <svg
                  className="pointer-events-none absolute inset-x-0 top-12 h-[196px] w-full overflow-visible"
                  viewBox={`0 0 100 ${chartHeight}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <polyline
                    fill="none"
                    points={polylinePoints}
                    stroke="#b7791f"
                    strokeDasharray="5 5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.6"
                  />
                  {selectedSummaries.map((item, index) => {
                    const x = 10 + index * 20;
                    const y = chartHeight - (item.suggestedCount / tallestValue) * chartHeight;
                    return <circle key={`point:${item.stars}`} cx={x} cy={y} fill="#b7791f" r="2.2" />;
                  })}
                </svg>

                <div className="grid gap-4 md:grid-cols-5">
                  {selectedSummaries.map((item) => {
                    const barHeight = Math.max((item.count / tallestValue) * chartHeight, item.count > 0 ? 24 : 0);
                    const barTone =
                      item.deltaCount > 0 ? "bg-[color:#e97a73]" : item.deltaCount < 0 ? "bg-[color:#c89153]" : "bg-[color:#d8c0a3]";
                    const isActive = item.stars === activeStar;

                    return (
                      <div key={`bar:${item.stars}`} className="flex flex-col">
                        <div className="mb-3 flex items-baseline justify-between gap-2">
                          <div>
                            <p className="text-xs text-[var(--cockpit-muted-foreground)]">{item.stars}星</p>
                            <p className="mt-1 text-xl font-semibold text-[var(--cockpit-foreground)]">{item.count} 人</p>
                          </div>
                          <span
                            className={
                              item.deltaCount === 0
                                ? "text-xs text-[var(--cockpit-muted-foreground)]"
                                : item.deltaCount > 0
                                  ? "text-xs font-medium text-[color:#c2410c]"
                                  : "text-xs font-medium text-[color:#b7791f]"
                            }
                          >
                            {item.deltaCount === 0 ? "符合建议" : item.deltaCount > 0 ? `超出 ${item.deltaCount} 人` : `不足 ${Math.abs(item.deltaCount)} 人`}
                          </span>
                        </div>

                        <div className="relative flex h-[196px] flex-col justify-end rounded-[22px] border bg-white/70 px-3 py-3">
                          <div className="absolute inset-x-4 top-4 h-px bg-[color:rgba(191,127,65,0.12)]" />
                          <div className="absolute inset-x-4 top-[37%] h-px bg-[color:rgba(191,127,65,0.12)]" />
                          <div className="absolute inset-x-4 top-[70%] h-px bg-[color:rgba(191,127,65,0.12)]" />

                          <div className="flex h-full items-end justify-center">
                            {item.count === 0 ? (
                              <div className="w-full rounded-[16px] bg-[color:rgba(191,127,65,0.08)] py-3 text-center text-xs text-[var(--cockpit-muted-foreground)]">
                                当前没有员工
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setActiveStarOverride(item.stars)}
                                className={`mx-auto w-[46%] rounded-[10px] rounded-b-[6px] ${barTone} transition-[transform,box-shadow,outline-color] hover:-translate-y-0.5 ${
                                  isActive ? "outline outline-2 outline-offset-4 outline-[color:#b7791f]" : "outline outline-1 outline-offset-2 outline-transparent"
                                }`}
                                style={{ height: `${barHeight}px` }}
                                title={`${item.stars}星 · ${item.count}人：${item.names.join("、")}`}
                                aria-label={`${item.stars}星 ${item.count}人`}
                              />
                            )}
                          </div>
                        </div>

                        <div className="mt-3 text-xs leading-5 text-[var(--cockpit-muted-foreground)]">
                          <span className="font-medium text-[var(--cockpit-foreground)]">建议：</span>
                          {item.summary}，当前约 {item.suggestedCount} 人
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border bg-[color:rgba(191,127,65,0.04)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs text-[var(--cockpit-muted-foreground)]">当前查看</p>
                  <h4 className="mt-1 text-lg font-semibold text-[var(--cockpit-foreground)]">
                    {selectedBucket.stars}星 · {selectedBucket.count}人
                  </h4>
                </div>
                <div className="rounded-full border px-3 py-1 text-xs text-[var(--cockpit-muted-foreground)]">
                  点击柱子切换名单
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {selectedBucket.names.length === 0 ? (
                  <span className="rounded-full bg-white px-3 py-2 text-sm text-[var(--cockpit-muted-foreground)]">
                    当前没有员工落在这个星级
                  </span>
                ) : (
                  selectedBucket.names.map((name) => (
                    <span
                      key={`${selectedBucket.stars}:${name}`}
                      className="rounded-full border bg-white px-3 py-2 text-sm text-[var(--cockpit-foreground)]"
                    >
                      {name}
                    </span>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-[24px] border p-5">
            <div>
              <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">读图提示</p>
              <p className="mt-1 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">
                先看当前视角里哪几个星级明显高于或低于建议人数，再决定是否切到具体部门看原因。
              </p>
            </div>

            {selectedSummaries.map((item) => (
              <div key={`summary:${item.stars}`} className="rounded-[20px] border bg-[color:rgba(191,127,65,0.04)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[var(--cockpit-foreground)]">{item.stars}星</span>
                  <span className="text-sm text-[var(--cockpit-muted-foreground)]">{item.count} 人</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--cockpit-muted-foreground)]">
                  {item.deltaCount === 0
                    ? `当前人数与建议人数基本一致，建议约 ${item.suggestedCount} 人。`
                    : item.deltaCount > 0
                      ? `当前比建议人数多 ${item.deltaCount} 人，建议约 ${item.suggestedCount} 人。`
                      : `当前比建议人数少 ${Math.abs(item.deltaCount)} 人，建议约 ${item.suggestedCount} 人。`}
                </p>
              </div>
            ))}
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
