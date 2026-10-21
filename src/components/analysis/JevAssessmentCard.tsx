import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { JevDecisionInfo } from "@/data/analysis-data";

type JevAssessmentCardProps = {
  decision: JevDecisionInfo;
  /** Backend-computed data-confidence for the analysis, 0..1. */
  analysisConfidence?: number;
};

const CONCERN_LABELS: Record<JevDecisionInfo["concern_level"], string> = {
  low: "Low concern",
  moderate: "Moderate concern",
  high: "High concern",
  insufficient: "Assessment unavailable",
};

const CONCERN_COLORS: Record<JevDecisionInfo["concern_level"], { text: string; dot: string }> = {
  low: { text: "text-green-600 dark:text-green-400", dot: "bg-green-500" },
  moderate: { text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  high: { text: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  insufficient: { text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400" },
};

const PRIORITY_LABELS: Record<string, string> = {
  nutrition: "Nutrition",
  ingredients: "Ingredients",
  additives: "Additives",
  allergens: "Allergens",
  goal_alignment: "Your goals",
  general_awareness: "General awareness",
};

const STATUS_LABELS: Record<JevDecisionInfo["status"], string> = {
  ready: "Assessment ready",
  review: "Needs review — low model confidence",
  insufficient_evidence: "Some analysis information is unavailable",
};

const SOURCE_LABELS: Record<JevDecisionInfo["decision_source"], string> = {
  jev: "Jev decision layer",
  rule_engine: "FoodGuard rule engine",
};

/**
 * Human display for the backend's bounded decision block (Phase 33):
 * concern level, assessment confidence, evidence sufficiency and focus —
 * with a transparency expander instead of raw JSON. Confidence is shown as
 * an assessment signal, never as medical certainty.
 */
export function JevAssessmentCard({ decision, analysisConfidence }: JevAssessmentCardProps) {
  const [showHow, setShowHow] = useState(false);
  const concern = CONCERN_COLORS[decision.concern_level];
  const confidencePct = Math.round(
    Math.max(0, Math.min(1, decision.confidence ?? 0)) * 100,
  );
  const evidencePct =
    typeof decision.evidence_sufficient === "number"
      ? Math.round(Math.max(0, Math.min(1, decision.evidence_sufficient)) * 100)
      : null;
  const focus = decision.explanation_priority ? PRIORITY_LABELS[decision.explanation_priority] : null;
  const insufficient = decision.status === "insufficient_evidence";

  return (
    <section className="foodguard-card p-5 sm:p-6" aria-label="FoodGuard assessment">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">FoodGuard assessment</h2>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {STATUS_LABELS[decision.status]}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Concern level</p>
          <p className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${concern.text}`}>
            <span className={`size-2 rounded-full ${concern.dot}`} aria-hidden="true" />
            {CONCERN_LABELS[decision.concern_level]}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Assessment confidence</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{confidencePct}%</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Evidence</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {evidencePct === null
              ? "Not evaluated"
              : evidencePct >= 60
                ? `Sufficient (${evidencePct}%)`
                : `Limited (${evidencePct}%)`}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Focus</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {focus ?? (analysisConfidence !== undefined && analysisConfidence < 0.5 ? "General awareness" : "—")}
          </p>
        </div>
      </div>

      {insufficient && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          Some analysis information is unavailable. Please review the ingredients manually.
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowHow((v) => !v)}
        aria-expanded={showHow}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        How was this assessed?
        <ChevronDown className={`size-3.5 transition-transform ${showHow ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {showHow && (
        <dl className="mt-2 flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          <div className="flex flex-col gap-0.5">
            <dt className="font-medium text-foreground">Decision source</dt>
            <dd>{SOURCE_LABELS[decision.decision_source]}{decision.model ? ` · model: ${decision.model}` : ""}</dd>
          </div>
          {decision.question_version && (
            <div className="flex flex-col gap-0.5">
              <dt className="font-medium text-foreground">Question set</dt>
              <dd className="font-mono">{decision.question_version}</dd>
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <dt className="font-medium text-foreground">What this means</dt>
            <dd>
              Product facts (ingredients, nutrition, allergens) are extracted and scored by
              FoodGuard&apos;s deterministic rule engine. The concern level, evidence sufficiency and
              explanation focus above are structured decisions made over those facts only. Confidence
              reflects the model&apos;s certainty in this classification — it is an assessment signal,
              not a medical judgement.
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
