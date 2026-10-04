"use client";

import { Target, ArrowRight } from "lucide-react";
import type { DashboardLabels } from "@/data/dashboard-labels";
import type { UserPreference } from "@/types/dashboard";

type PersonalizedInsightProps = {
  labels: DashboardLabels["personalized"];
  preferences: UserPreference;
  onEdit: () => void;
};

export function PersonalizedInsight({
  labels,
  preferences,
  onEdit,
}: PersonalizedInsightProps) {
  return (
    <div className="foodguard-card border-primary/15 bg-secondary/60 p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Target className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{labels.title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Personalized for your choices</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{labels.goalLabel}:</span>
          <span className="rounded-full bg-white px-2.5 py-1 text-sm font-medium text-foreground shadow-sm">
            {preferences.goal || "Not set"}
          </span>
        </div>
        {preferences.focuses.map((focus) => (
          <div key={focus} className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{labels.focusLabel}:</span>
            <span className="text-sm font-medium text-foreground">{focus}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary-dark"
      >
        {labels.editButton}
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
