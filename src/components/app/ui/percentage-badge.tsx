"use client";

import type { ComponentType } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PercentageResult, TrendDirection } from "@/lib/types";

interface PercentageBadgeProps {
  result: PercentageResult;
  className?: string;
}

const directionClass: Record<TrendDirection, string> = {
  up: "text-success",
  down: "text-error",
  neutral: "text-muted-foreground",
  na: "text-muted-foreground",
};

const directionIcon: Record<
  TrendDirection,
  ComponentType<{ className?: string }> | null
> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  neutral: Minus,
  na: null,
};

export function PercentageBadge({ result, className }: PercentageBadgeProps) {
  const Icon = directionIcon[result.direction];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-xs tabular-nums",
        directionClass[result.direction],
        className,
      )}
    >
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {result.display}
    </span>
  );
}
