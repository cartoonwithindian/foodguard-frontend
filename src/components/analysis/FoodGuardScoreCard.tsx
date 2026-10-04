"use client";

import { Info, CheckCircle2, AlertCircle } from "lucide-react";
import type { FoodGuardScoreResult } from "@/data/analysis-data";

type FoodGuardScoreCardProps = {
  foodguardScore: FoodGuardScoreResult;
  confidenceLabel: string;
};

const COMPONENT_LABELS: Record<string, { label: string; icon: string }> = {
  nutrient: { label: "RDA / Nutrient Check", icon: "🍎" },
  ingredient_profile: { label: "Ingredient Profiling", icon: "🧪" },
  ingredient_concern: { label: "Ingredients of Concern", icon: "🔍" },
  processing: { label: "Processing Level", icon: "⚙️" },
};

const STATUS_COLORS: Record<string, string> = {
  available: "text-green-600 dark:text-green-400",
  derived: "text-blue-600 dark:text-blue-400",
  insufficient: "text-amber-600 dark:text-amber-400",
};

function getScoreBarColor(score: number): string {
  if (score >= 4) return "bg-green-500";
  if (score >= 3) return "bg-emerald-400";
  if (score >= 2) return "bg-amber-400";
  if (score >= 1) return "bg-orange-400";
  return "bg-red-400";
}

// The ingredient_concern component is scored INVERTED: higher = fewer concerns.
// Print a risk label instead of "5.0 / 5", which reads as "5 of 5 ingredients are concerning".
function concernRisk(score: number): { label: string; color: string } {
  if (score >= 4.5) return { label: "Low risk", color: "text-green-600 dark:text-green-400" };
  if (score >= 3) return { label: "Moderate risk", color: "text-amber-600 dark:text-amber-400" };
  return { label: "High risk", color: "text-red-600 dark:text-red-400" };
}

export function FoodGuardScoreCard({ foodguardScore, confidenceLabel }: FoodGuardScoreCardProps) {
  const { final_score, rating, confidence, components, positive_factors, negative_factors, explanation } = foodguardScore;

  const overallColor =
    final_score >= 4
      ? "text-green-600 dark:text-green-400"
      : final_score >= 3
        ? "text-emerald-500 dark:text-emerald-400"
        : final_score >= 2
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-600 dark:text-red-400";

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">FoodGuard Health Score</h3>
      </div>

      {/* Main score */}
      <div className="mb-6 flex flex-col items-center gap-2">
        <div className="flex items-baseline gap-1">
          <span className={`text-5xl font-bold ${overallColor}`}>{final_score.toFixed(1)}</span>
          <span className="text-lg text-muted-foreground">/ 5</span>
        </div>
        <span className={`text-sm font-medium ${overallColor}`}>{rating}</span>
      </div>

      {/* Confidence */}
      <div className="mb-5 flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-2.5">
        <Info className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs text-muted-foreground">
          {confidenceLabel}: <span className="font-medium text-foreground">{Math.round(confidence * 100)}%</span>
        </span>
      </div>

      {/* Four component scores */}
      <div className="mb-5 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Component Scores
        </h4>
        {Object.entries(components).map(([key, comp]) => {
          const meta = COMPONENT_LABELS[key];
          if (!meta) return null;
          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">
                  <span className="mr-1.5">{meta.icon}</span>
                  {meta.label}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${STATUS_COLORS[comp.status] ?? ""}`}>
                    {comp.status}
                  </span>
                  {key === "ingredient_concern" ? (
                    <span className={`text-sm font-semibold ${concernRisk(comp.score).color}`}>
                      {concernRisk(comp.score).label}
                    </span>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-foreground">
                        {comp.score.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">/ 5</span>
                    </>
                  )}
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${getScoreBarColor(comp.score)}`}
                  style={{ width: `${(comp.score / 5) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Positive and negative factors */}
      {(positive_factors.length > 0 || negative_factors.length > 0) && (
        <div className="mb-4 space-y-3">
          {positive_factors.length > 0 && (
            <div>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
                Positive Factors
              </h4>
              <ul className="space-y-1">
                {positive_factors.map((factor, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-green-500" aria-hidden="true" />
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {negative_factors.length > 0 && (
            <div>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Areas for Attention
              </h4>
              <ul className="space-y-1">
                {negative_factors.map((factor, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <AlertCircle className="mt-0.5 size-3 shrink-0 text-amber-500" aria-hidden="true" />
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}
