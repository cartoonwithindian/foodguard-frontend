import { CheckCircle2, AlertCircle, AlertTriangle, HelpCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssessmentLevel } from "@/data/analysis-data";

export type StatusLevel = "good" | "moderate" | "concern" | "high-risk" | "neutral";

const LEVEL_STYLES: Record<StatusLevel, { bg: string; text: string; dot: string }> = {
  good: { bg: "bg-status-good/10", text: "text-status-good", dot: "bg-status-good" },
  moderate: { bg: "bg-status-moderate/10", text: "text-status-moderate", dot: "bg-status-moderate" },
  concern: { bg: "bg-status-concern/10", text: "text-status-concern", dot: "bg-status-concern" },
  "high-risk": { bg: "bg-status-high-risk/10", text: "text-status-high-risk", dot: "bg-status-high-risk" },
  neutral: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

const ASSESSMENT_TO_LEVEL: Record<AssessmentLevel, StatusLevel> = {
  low: "good",
  moderate: "moderate",
  high: "high-risk",
  insufficient: "neutral",
};

const LEVEL_ICONS: Record<StatusLevel, React.ComponentType<{ className?: string }>> = {
  good: CheckCircle2,
  moderate: AlertCircle,
  concern: AlertTriangle,
  "high-risk": AlertTriangle,
  neutral: Circle,
};

type StatusBadgeProps = {
  level: StatusLevel;
  /** The word is always rendered — color never carries meaning alone. */
  label: string;
  icon?: boolean;
  className?: string;
};

/** Map an analysis assessment level to the shared status palette. */
export function statusLevelForAssessment(level: AssessmentLevel): StatusLevel {
  return ASSESSMENT_TO_LEVEL[level];
}

/**
 * The one status badge for the whole app. Styles come from the centralized
 * `--status-*` tokens via `@theme`, so screens never hardcode hex colors, and
 * the label text is always shown so color is not the only signal.
 */
export function StatusBadge({ level, label, icon = true, className }: StatusBadgeProps) {
  const style = LEVEL_STYLES[level];
  const Icon = LEVEL_ICONS[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        style.bg,
        style.text,
        className,
      )}
    >
      {icon ? <Icon className="size-3.5" aria-hidden="true" /> : <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden="true" />}
      {label}
    </span>
  );
}
