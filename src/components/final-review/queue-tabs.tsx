"use client";

import { cn } from "@/lib/utils";

export type QueueTabItem = {
  key: string;
  label: string;
  count: number;
};

type QueueTabsProps = {
  items: QueueTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
};

export function QueueTabs({ items, activeKey, onChange }: QueueTabsProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {items.map((item) => {
        const active = item.key === activeKey;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={cn(
              "rounded-2xl border px-4 py-3 text-left transition",
              active
                ? "border-[color:var(--cockpit-accent-strong)] bg-[color:var(--cockpit-accent)]/20"
                : "border-border/60 bg-white/80 hover:border-[color:var(--cockpit-accent)]",
            )}
            aria-pressed={active}
          >
            <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">{item.label}</p>
            <p className="mt-2 text-xs text-[var(--cockpit-muted-foreground)]">{item.count} 人</p>
          </button>
        );
      })}
    </div>
  );
}
