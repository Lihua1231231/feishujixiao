"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const STAR_DESCRIPTIONS: Record<number, string> = {
  5: "取得杰出的成果，所做的工作在世界范围拥有领先性，拥有极强的推动力，拥有显著的影响力",
  4: "超出期望的成果，所做的工作在行业内具有竞争力，拥有很强的推动力，拥有一定的影响力",
  3: "符合预期的成果，始终如一地完成工作职责，可以较好的完成工作落地、闭环，具有较好的学习能力，具有不错的推动力",
  2: "成果不达预期，需要提高。基本满足考核要求，但与他人相比不能充分执行所有的工作职责，或虽执行了职责但平均水平较低或成果较差",
  1: "成果远低于预期，未达合格标准。不能证明其具备所需的知识和技能或不能利用所需的知识和技能；不能执行其工作职责",
};

interface StarRatingProps {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZE_MAP = {
  sm: "h-5 w-5",
  md: "h-7 w-7",
  lg: "h-9 w-9",
} as const;

const GAP_MAP = {
  sm: "gap-0.5",
  md: "gap-1",
  lg: "gap-1.5",
} as const;

export function StarRating({
  value,
  onChange,
  disabled = false,
  size = "md",
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const activeValue = hovered ?? value;
  const iconSize = SIZE_MAP[size];

  return (
    <div className="space-y-1.5">
      <div
        className={cn("inline-flex items-center rounded-lg bg-muted/60 px-2 py-1.5", GAP_MAP[size])}
        onMouseLeave={() => setHovered(null)}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = activeValue != null && n <= activeValue;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(n)}
              onMouseEnter={() => !disabled && setHovered(n)}
              className={cn(
                "rounded-md p-1 transition-all duration-[var(--transition-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                disabled
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer hover:scale-110 active:scale-95",
                filled && !disabled && "hover:bg-amber-50"
              )}
            >
              <Star
                className={cn(
                  iconSize,
                  "transition-all duration-[var(--transition-fast)]",
                  filled
                    ? "fill-amber-400 text-amber-400 drop-shadow-[0_1px_2px_rgba(245,158,11,0.3)]"
                    : "fill-gray-300 text-gray-300 hover:fill-amber-200 hover:text-amber-200"
                )}
              />
            </button>
          );
        })}
        {value == null && (
          <span className="ml-1 text-xs text-muted-foreground">请评分</span>
        )}
      </div>
      {activeValue != null && (
        <p className="text-xs text-muted-foreground">
          {activeValue}星 — {STAR_DESCRIPTIONS[activeValue]}
        </p>
      )}
    </div>
  );
}
