import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import type { AttentionPoint, AssessmentLevel } from "@/data/analysis-data";

type AttentionPointsProps = {
  title: string;
  points: AttentionPoint[];
};

const SEVERITY_CONFIG: Record<
  AssessmentLevel,
  { icon: typeof AlertTriangle; color: string; bg: string; borderColor: string }
> = {
  high: {
    icon: AlertTriangle,
    color: "text-rose-700",
    bg: "bg-rose-50",
    borderColor: "border-rose-200",
  },
  moderate: {
    icon: AlertCircle,
    color: "text-amber-700",
    bg: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  low: {
    icon: Info,
    color: "text-green-700",
    bg: "bg-green-50",
    borderColor: "border-green-200",
  },
  insufficient: {
    icon: Info,
    color: "text-gray-500 dark:text-gray-400",
    bg: "bg-gray-50 dark:bg-gray-900/40",
    borderColor: "border-gray-200 dark:border-gray-800",
  },
};

export function AttentionPoints({ title, points }: AttentionPointsProps) {
  if (points.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="space-y-2">
        {points.map((point, i) => {
          const config = SEVERITY_CONFIG[point.severity];
          const Icon = config.icon;
          return (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-xl border ${config.borderColor} ${config.bg} p-3`}
            >
              <Icon
                className={`size-4 shrink-0 ${config.color} mt-0.5`}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {point.displayName ?? point.name}
                  </span>
                  {point.amount && (
                    <span className="text-xs text-muted-foreground">
                      {point.amount}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {point.reason}
                </p>
                {point.source && (
                  <p className="mt-1 text-[11px] text-muted-foreground/80">
                    Basis: {point.source}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
