"use client";

import { useDeferredValue, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type RosterSearchItem = {
  id: string;
  name: string;
  meta: string;
  status: string;
  tone?: "default" | "outline" | "secondary" | "destructive";
};

type RosterSearchListProps = {
  searchPlaceholder: string;
  emptyText: string;
  selectedId: string | null;
  items: RosterSearchItem[];
  onSelect: (id: string) => void;
};

export function RosterSearchList({
  searchPlaceholder,
  emptyText,
  selectedId,
  items,
  onSelect,
}: RosterSearchListProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const visibleItems = items.filter((item) =>
    normalizedQuery.length === 0
      ? true
      : `${item.name} ${item.meta} ${item.status}`.toLowerCase().includes(normalizedQuery),
  );

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
      />

      <div className="flex items-center justify-between gap-3 text-xs text-[var(--cockpit-muted-foreground)]">
        <span>搜索结果</span>
        <span>
          {visibleItems.length}/{items.length}
        </span>
      </div>

      <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
        {visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-4 py-6 text-sm text-[var(--cockpit-muted-foreground)]">{emptyText}</div>
        ) : null}

        {visibleItems.map((item) => {
          const selected = item.id === selectedId;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-pressed={selected}
              className={cn(
                "w-full rounded-2xl border px-4 py-3 text-left transition",
                selected
                  ? "border-[color:var(--cockpit-accent-strong)] bg-[color:var(--cockpit-accent)]/25"
                  : "border-border/60 bg-white/80 hover:border-[color:var(--cockpit-accent)]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--cockpit-foreground)]">{item.name}</p>
                  <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">{item.meta}</p>
                </div>
                <Badge variant={item.tone || "outline"}>{item.status}</Badge>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
