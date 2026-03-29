"use client";

import type { CSSProperties, ReactNode } from "react";

export type CockpitBriefingBlock = {
  title: string;
  content: ReactNode;
};

export type CockpitMetric = {
  title: string;
  value: ReactNode;
  description: string;
};

type CockpitShellProps = {
  title: string;
  description: string;
  guideDescription: string;
  summaryLabel: string;
  summary: string;
  briefingBlocks: CockpitBriefingBlock[];
  metrics: CockpitMetric[];
  main: ReactNode;
  aside?: ReactNode;
};

export function CockpitShell({
  title,
  description,
  guideDescription,
  summaryLabel,
  summary,
  briefingBlocks,
  metrics,
  main,
  aside,
}: CockpitShellProps) {
  const shellStyle: CSSProperties = {
    background: "linear-gradient(180deg, var(--cockpit-surface-strong) 0%, var(--cockpit-surface) 100%)",
    borderColor: "var(--cockpit-border)",
    boxShadow: "var(--shadow-md)",
  };
  const panelStyle: CSSProperties = {
    background: "var(--cockpit-surface)",
    borderColor: "var(--cockpit-border)",
    boxShadow: "var(--shadow-xs)",
  };
  const strongPanelStyle: CSSProperties = {
    ...panelStyle,
    background: [
      "radial-gradient(circle at top right, rgba(255, 255, 255, 0.34), transparent 45%)",
      "linear-gradient(180deg, rgba(255, 255, 255, 0.1), transparent)",
      "var(--cockpit-surface-strong)",
    ].join(", "),
  };

  return (
    <section className="space-y-4 rounded-[var(--radius-3xl)] border p-4 md:p-5" style={shellStyle}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.8fr)]">
        <div className="rounded-[var(--radius-2xl)] border p-5 md:p-6" style={panelStyle}>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--cockpit-muted-foreground)]">
            原则
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--cockpit-foreground)]">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">{description}</p>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-[var(--cockpit-foreground)]">{guideDescription}</p>
        </div>

        <div className="rounded-[var(--radius-2xl)] border p-5 md:p-6" style={strongPanelStyle}>
          <p className="text-sm font-medium text-[var(--cockpit-muted-foreground)]">{summaryLabel}</p>
          <p className="mt-3 text-lg font-semibold leading-8 text-[var(--cockpit-foreground)] md:text-[1.35rem]">{summary}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {briefingBlocks.map((block) => (
          <div key={block.title} className="rounded-[var(--radius-2xl)] border p-5" style={panelStyle}>
            <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">{block.title}</p>
            <div className="mt-4 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">{block.content}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.title} className="rounded-[var(--radius-2xl)] border p-5" style={panelStyle}>
            <p className="text-xs font-medium text-[var(--cockpit-muted-foreground)]">{metric.title}</p>
            <div className="mt-3 text-2xl font-semibold text-[var(--cockpit-foreground)]">{metric.value}</div>
            <p className="mt-2 text-xs leading-5 text-[var(--cockpit-muted-foreground)]">{metric.description}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.75fr)]">
        <div className="space-y-4">{main}</div>
        {aside ? <div className="space-y-4">{aside}</div> : null}
      </div>
    </section>
  );
}
