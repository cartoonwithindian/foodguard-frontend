"use client";

import { AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import type { HistoryLabels } from "@/data/history-labels";
import { CONCERN_COLORS } from "@/data/mock-data";

type SummaryCardProps = {
  level: "high" | "moderate" | "low";
  count: number;
  label: string;
  onClick?: () => void;
};

function SummaryCard({ level, count, label, onClick }: SummaryCardProps) {
  const config = {
    high: AlertTriangle,
    moderate: AlertCircle,
    low: CheckCircle2,
  }[level];
  const colors = CONCERN_COLORS[level];
  const Icon = config;
  const surface = {
    high: "border-rose-200/80 bg-rose-50/70",
    moderate: "border-amber-200/80 bg-amber-50/70",
    low: "border-green-200/80 bg-green-50/70",
  }[level];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-2 rounded-xl border ${surface} p-5 text-center shadow-sm transition-all hover:border-primary/30 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
    >
      <Icon className={`size-6 ${colors.text}`} aria-hidden="true" />
      <span className={`text-3xl font-bold ${colors.text}`}>{count}</span>
      <span className="flex items-center gap-1.5">
        <span className={`size-2 rounded-full ${colors.dot}`} aria-hidden="true" />
        <span className={`text-sm font-medium ${colors.text}`}>{label}</span>
      </span>
    </button>
  );
}

type HistorySummaryProps = {
  labels: HistoryLabels["summary"];
  counts: { high: number; moderate: number; low: number };
  onHighClick?: () => void;
  onModerateClick?: () => void;
  onLowClick?: () => void;
};

export function HistorySummary({
  labels,
  counts,
  onHighClick,
  onModerateClick,
  onLowClick,
}: HistorySummaryProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{labels.title}</h2>
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          level="high"
          count={counts.high}
          label={labels.high}
          onClick={onHighClick}
        />
        <SummaryCard
          level="moderate"
          count={counts.moderate}
          label={labels.moderate}
          onClick={onModerateClick}
        />
        <SummaryCard
          level="low"
          count={counts.low}
          label={labels.low}
          onClick={onLowClick}
        />
      </div>
    </div>
  );
}
