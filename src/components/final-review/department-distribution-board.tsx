"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DistributionEntry } from "./types";

type DepartmentDistributionBoardProps = {
  departments: Array<{
    department: string;
    total: number;
    distribution: DistributionEntry[];
  }>;
};

const DEPARTMENT_PALETTE = [
  "#f97373",
  "#f59e0b",
  "#34c759",
  "#38bdf8",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#84cc16",
  "#6366f1",
];

const STAR_RULES = [
  { stars: 1, ratio: 0.05, summary: "建议上限 5%" },
  { stars: 2, ratio: 0.15, summary: "建议上限 15%" },
  { stars: 3, ratio: 0.5, summary: "建议下限 50%" },
  { stars: 4, ratio: 0.2, summary: "建议上限 20%" },
  { stars: 5, ratio: 0.1, summary: "建议上限 10%" },
] as const;

function compactNames(names: string[]) {
  if (names.length === 0) return "当前没有员工";
  if (names.length <= 3) return names.join("、");
  return `${names.slice(0, 3).join("、")} 等 ${names.length} 人`;
}

export function DepartmentDistributionBoard({ departments }: DepartmentDistributionBoardProps) {
  const departmentColors = Object.fromEntries(
    departments.map((item, index) => [item.department, DEPARTMENT_PALETTE[index % DEPARTMENT_PALETTE.length]]),
  );

  const totalEmployees = departments.reduce((sum, item) => sum + item.total, 0);
  const stars = STAR_RULES.map((item) => item.stars);
  const segmentsByStar = stars.map((starsValue) =>
    departments
      .map((department) => {
        const bucket = department.distribution.find((item) => item.stars === starsValue) ?? {
          stars: starsValue,
          count: 0,
          pct: 0,
          exceeded: false,
          delta: 0,
          names: [],
        };

        return {
          department: department.department,
          count: bucket.count,
          names: bucket.names,
        };
      })
      .filter((item) => item.count > 0),
  );

  const starSummaries = STAR_RULES.map((rule, index) => {
    const actualCount = segmentsByStar[index].reduce((sum, item) => sum + item.count, 0);
    const suggestedCount = Math.round(totalEmployees * rule.ratio);
    const delta = actualCount - suggestedCount;

    return {
      ...rule,
      actualCount,
      suggestedCount,
      delta,
    };
  });

  const tallestValue = Math.max(
    1,
    ...starSummaries.map((item) => Math.max(item.actualCount, item.suggestedCount)),
  );

  const chartHeight = 260;
  const polylinePoints = starSummaries
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
          用一张图同时看五个星级里各部门的人数构成。柱体按部门分色，折线是按当前总人数折算的建议人数线；把鼠标停在色块上，可以看到具体是谁。
        </p>
      </CardHeader>
      <CardContent className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-[24px] border p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">部门分布总览</p>
              <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">
                共 {totalEmployees} 人，先看每个星级里是谁在拉高或拉低整体分布。
              </p>
            </div>
            <div className="rounded-full border px-3 py-1 text-xs text-[var(--cockpit-muted-foreground)]">
              建议人数线
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border bg-[color:rgba(191,127,65,0.04)] px-4 py-5">
            <div className="relative">
              <svg
                className="pointer-events-none absolute inset-x-0 top-8 h-[260px] w-full overflow-visible"
                viewBox={`0 0 100 ${chartHeight}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline
                  fill="none"
                  points={polylinePoints}
                  stroke="#b45309"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
                {starSummaries.map((item, index) => {
                  const x = 10 + index * 20;
                  const y = chartHeight - (item.suggestedCount / tallestValue) * chartHeight;
                  return <circle key={`point:${item.stars}`} cx={x} cy={y} fill="#b45309" r="2.2" />;
                })}
              </svg>

              <div className="grid gap-4 md:grid-cols-5">
                {starSummaries.map((item, index) => (
                  <div key={`star:${item.stars}`} className="flex flex-col">
                    <div className="mb-3 flex items-end justify-between">
                      <div>
                        <p className="text-xs text-[var(--cockpit-muted-foreground)]">{item.stars}星</p>
                        <p className="mt-1 text-lg font-semibold text-[var(--cockpit-foreground)]">{item.actualCount} 人</p>
                      </div>
                      <span
                        className={
                          item.delta === 0
                            ? "text-xs text-[var(--cockpit-muted-foreground)]"
                            : item.delta > 0
                              ? "text-xs font-medium text-[color:#b45309]"
                              : "text-xs font-medium text-[color:#2563eb]"
                        }
                      >
                        {item.delta === 0 ? "符合建议" : item.delta > 0 ? `超出 ${item.delta} 人` : `不足 ${Math.abs(item.delta)} 人`}
                      </span>
                    </div>

                    <div className="relative flex h-[260px] flex-col justify-end rounded-[20px] border bg-white/70 px-3 py-3">
                      <div className="absolute inset-x-3 top-3 h-px bg-[color:rgba(191,127,65,0.12)]" />
                      <div className="absolute inset-x-3 top-[35%] h-px bg-[color:rgba(191,127,65,0.12)]" />
                      <div className="absolute inset-x-3 top-[68%] h-px bg-[color:rgba(191,127,65,0.12)]" />
                      <div className="flex h-full flex-col justify-end gap-1">
                        {segmentsByStar[index].length === 0 ? (
                          <div className="flex h-full items-end">
                            <div className="w-full rounded-[14px] bg-[color:rgba(191,127,65,0.08)] py-3 text-center text-xs text-[var(--cockpit-muted-foreground)]">
                              当前没有员工
                            </div>
                          </div>
                        ) : (
                          segmentsByStar[index].map((segment) => (
                            <div
                              key={`${item.stars}:${segment.department}`}
                              className="min-h-[8px] rounded-[12px] transition-transform hover:scale-[1.01]"
                              style={{
                                height: `${(segment.count / tallestValue) * chartHeight}px`,
                                backgroundColor: departmentColors[segment.department],
                              }}
                              title={`${item.stars}星 · ${segment.department} · ${segment.count}人：${segment.names.join("、")}`}
                            >
                              <div className="truncate px-3 py-2 text-xs font-medium text-white/95">
                                {compactNames(segment.names)}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mt-3 text-xs leading-5 text-[var(--cockpit-muted-foreground)]">
                      <span className="font-medium text-[var(--cockpit-foreground)]">建议：</span>
                      {item.summary}，当前约 {item.suggestedCount} 人
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-[24px] border p-5">
          <div>
            <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">部门图例</p>
            <p className="mt-1 text-xs leading-5 text-[var(--cockpit-muted-foreground)]">
              每种颜色代表一个部门。右侧先看部门总人数，再结合柱体看这个部门主要集中在哪个星级。
            </p>
          </div>

          <div className="space-y-2">
            {departments.map((item) => (
              <div key={`legend:${item.department}`} className="flex items-start justify-between gap-3 rounded-2xl border px-3 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="mt-1 h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: departmentColors[item.department] }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--cockpit-foreground)]">{item.department}</p>
                    <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">
                      {item.distribution.filter((bucket) => bucket.count > 0).map((bucket) => `${bucket.stars}星 ${bucket.count}人`).join(" · ") || "当前没有分布数据"}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-medium text-[var(--cockpit-foreground)]">{item.total} 人</span>
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
