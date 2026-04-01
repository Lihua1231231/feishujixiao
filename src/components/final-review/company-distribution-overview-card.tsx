"use client";

import type { CSSProperties } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompanyDistributionOverview } from "./types";

type CompanyDistributionOverviewCardProps = {
  title: string;
  description: string;
  overview: CompanyDistributionOverview;
};

const DISTRIBUTION_RULE_LABELS = {
  1: "一星≤5%",
  2: "二星≤15%",
  3: "三星50%+",
  4: "四星≤20%",
  5: "五星≤10%",
} as const;

function formatSuggestedCountRange(stars: number, denominator: number) {
  if (denominator <= 0) return "0 人";
  const raw = denominator * (
    stars === 5 ? 0.1
      : stars === 4 ? 0.2
        : stars === 3 ? 0.5
          : stars === 2 ? 0.15
            : 0.05
  );
  const floor = Math.floor(raw);
  const ceil = Math.ceil(raw);
  if (stars === 3) {
    return floor === ceil ? `${ceil} 人+` : `${floor}-${ceil} 人+`;
  }
  return floor === ceil ? `${ceil} 人` : `${floor}-${ceil} 人`;
}

function formatCurrentCountSummary(
  distribution: Array<{ stars: number; count: number }>,
) {
  const counts = new Map(distribution.map((item) => [item.stars, item.count]));
  return `当前各档对应人数：五星${counts.get(5) || 0}人，四星${counts.get(4) || 0}人，三星${counts.get(3) || 0}人，二星${counts.get(2) || 0}人，一星${counts.get(1) || 0}人。`;
}

export function CompanyDistributionOverviewCard({
  title,
  description,
  overview,
}: CompanyDistributionOverviewCardProps) {
  const panelStyle: CSSProperties = {
    background: "var(--cockpit-surface)",
    borderColor: "var(--cockpit-border)",
    boxShadow: "var(--shadow-xs)",
  };

  const data = overview.distribution.map((item) => ({
    ...item,
    label: `${item.stars}星`,
    namesLabel: item.names.length ? item.names.join("、") : "当前没有员工落在这个星级",
    pctLabel: `${item.pct.toFixed(1)}%`,
    ruleLabel: DISTRIBUTION_RULE_LABELS[item.stars as keyof typeof DISTRIBUTION_RULE_LABELS],
    countRange: formatSuggestedCountRange(item.stars, overview.includedCount),
  }));
  const excludedCount = Math.max(overview.totalParticipants - overview.includedCount, 0);
  const progressLabel = `${overview.calibratedCount}/${overview.includedCount || 0}`;
  const currentCountSummary = formatCurrentCountSummary(overview.distribution);

  return (
    <Card className="rounded-[var(--radius-2xl)] border shadow-none" style={panelStyle}>
      <CardHeader className="space-y-3">
        <div>
          <CardTitle className="text-base text-[var(--cockpit-foreground)]">{title}</CardTitle>
          <CardDescription className="mt-1 text-[var(--cockpit-muted-foreground)]">{description}</CardDescription>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border px-3 py-3">
            <p className="text-xs text-[var(--cockpit-muted-foreground)]">本次绩效考核参评</p>
            <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{overview.totalParticipants} 人</p>
          </div>
          <div className="rounded-2xl border px-3 py-3">
            <p className="text-xs text-[var(--cockpit-muted-foreground)]">当前图统计口径</p>
            <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{overview.includedCount} 人</p>
            {excludedCount > 0 ? (
              <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">已剔除 ROOT 3 人 + 已离职 3 人</p>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-2 sm:grid-cols-5">
          {data.map((item) => (
            <div key={`headline:${item.label}`} className="rounded-2xl border px-3 py-3">
              <p className="text-xs text-[var(--cockpit-muted-foreground)]">{item.label}</p>
              <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{item.count} 人</p>
              <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">{item.pctLabel}</p>
            </div>
          ))}
        </div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(125, 98, 70, 0.14)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--cockpit-muted-foreground)", fontSize: 12 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--cockpit-muted-foreground)", fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: "rgba(212, 166, 104, 0.1)" }}
                contentStyle={{
                  background: "var(--cockpit-surface)",
                  border: "1px solid var(--cockpit-border)",
                  borderRadius: "16px",
                  color: "var(--cockpit-foreground)",
                }}
                formatter={(value, _name, item) => {
                  const row = item.payload;
                  return [`${value} 人 · ${row.pctLabel}`, row.ruleLabel];
                }}
                labelFormatter={(label, payload) => {
                  const row = payload[0]?.payload;
                  return row ? `${label} · ${row.namesLabel}` : String(label);
                }}
              />
              <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                {data.map((item) => (
                  <Cell
                    key={item.label}
                    fill={item.exceeded ? "var(--destructive)" : "var(--cockpit-accent-strong)"}
                    fillOpacity={item.exceeded ? 0.82 : 0.95}
                  />
                ))}
                <LabelList dataKey="count" position="top" fill="var(--cockpit-foreground)" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 rounded-2xl border px-4 py-3 text-sm leading-7 text-[var(--cockpit-foreground)]">
          <p>建议分布：五星≤10%，四星≤20%，三星50%+，二星≤15%，一星≤5%。</p>
          <p className="mt-1">{currentCountSummary}</p>
        </div>
      </CardContent>
    </Card>
  );
}
