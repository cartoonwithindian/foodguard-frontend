"use client";

import { AlertTriangle, Minus, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardLabels } from "@/data/dashboard-labels";
import type { ConcernLevel } from "@/data/mock-data";

type ProductOverviewProps = {
  labels: DashboardLabels["summary"];
  summary: { high: number; moderate: number; low: number };
  onViewHistory: () => void;
};

const levels: {
  key: ConcernLevel;
  icon: typeof AlertTriangle;
  colors: { card: string; icon: string; text: string };
}[] = [
  {
    key: "high",
    icon: AlertTriangle,
    colors: {
      card: "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40",
      icon: "text-red-600 dark:text-red-400",
      text: "text-red-700 dark:text-red-400",
    },
  },
  {
    key: "moderate",
    icon: Minus,
    colors: {
      card: "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40",
      icon: "text-amber-600 dark:text-amber-400",
      text: "text-amber-700 dark:text-amber-400",
    },
  },
  {
    key: "low",
    icon: CheckCircle,
    colors: {
      card: "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/40",
      icon: "text-green-600 dark:text-green-400",
      text: "text-green-700 dark:text-green-400",
    },
  },
];

export function ProductOverview({ labels, summary, onViewHistory }: ProductOverviewProps) {
  const countLabels: Record<ConcernLevel, string> = {
    high: labels.highCount,
    moderate: labels.moderateCount,
    low: labels.lowCount,
  };
  const nameLabels: Record<ConcernLevel, string> = {
    high: labels.high,
    moderate: labels.moderate,
    low: labels.low,
  };

  return (
    <div className="rounded-xl bg-card p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 text-base font-medium text-foreground">{labels.title}</h2>
      <div className="grid grid-cols-3 gap-3">
        {levels.map(({ key, icon: Icon, colors }) => (
          <div
            key={key}
            className={cn(
              "flex flex-col items-center rounded-lg border p-3 text-center",
              colors.card,
            )}
          >
            <Icon className={cn("mb-2 size-5", colors.icon)} aria-hidden="true" />
            <span className={cn("text-2xl font-bold", colors.text)}>
              {summary[key]}
            </span>
            <span className="mt-1 text-xs font-medium text-muted-foreground">
              {nameLabels[key]}
            </span>
            <span className="text-[11px] text-muted-foreground/70">
              {countLabels[key].replace("{count}", String(summary[key]))}
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onViewHistory}
        className="mt-4 w-full rounded-xl border border-border bg-card py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        {labels.viewButton}
      </button>
    </div>
  );
}
