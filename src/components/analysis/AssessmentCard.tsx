import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import type { AssessmentLevel } from "@/data/analysis-data";

type AssessmentCardProps = {
  level: AssessmentLevel;
  label: string;
  description: string;
  score: number;
};

const CONFIG: Record<
  AssessmentLevel,
  {
    icon: typeof CheckCircle2;
    bg: string;
    iconColor: string;
    borderColor: string;
    labelColor: string;
  }
> = {
  low: {
    icon: CheckCircle2,
    bg: "bg-green-50",
    iconColor: "text-green-700",
    borderColor: "border-green-200",
    labelColor: "text-green-800",
  },
  moderate: {
    icon: AlertCircle,
    bg: "bg-amber-50",
    iconColor: "text-amber-700",
    borderColor: "border-amber-200",
    labelColor: "text-amber-800",
  },
  high: {
    icon: AlertTriangle,
    bg: "bg-rose-50",
    iconColor: "text-rose-700",
    borderColor: "border-rose-200",
    labelColor: "text-rose-700",
  },
  insufficient: {
    icon: HelpCircle,
    bg: "bg-gray-50 dark:bg-gray-900/40",
    iconColor: "text-gray-500 dark:text-gray-400",
    borderColor: "border-gray-200 dark:border-gray-800",
    labelColor: "text-gray-600 dark:text-gray-400",
  },
};

export function AssessmentCard({
  level,
  label,
  description,
  score,
}: AssessmentCardProps) {
  const config = CONFIG[level];
  const Icon = config.icon;

  // Score is now 0.0–5.0 (FoodGuard four-component score)
  const scoreColor =
    score >= 4.0
      ? "text-green-800"
      : score >= 2.0
        ? "text-amber-800"
        : "text-rose-700";

  return (
    <div
      className={`flex flex-col items-center gap-4 rounded-2xl border ${config.borderColor} ${config.bg} p-6 text-center`}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-white/80">
        <Icon className={`size-7 ${config.iconColor}`} aria-hidden="true" />
      </div>
      <div>
        <h2 className={`text-lg font-bold ${config.labelColor}`}>{label}</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm leading-relaxed">
          {description}
        </p>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-bold ${scoreColor}`}>{score.toFixed(1)}</span>
        <span className="text-sm text-muted-foreground">/ 5</span>
      </div>
    </div>
  );
}
