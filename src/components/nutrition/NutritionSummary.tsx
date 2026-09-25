"use client";

import { BarChart3 } from "lucide-react";
import type { DetailedNutrition } from "@/data/nutrition-data";
import type { NutritionLabels } from "@/data/nutrition-labels";

type NutritionSummaryProps = {
  nutrition: DetailedNutrition;
  labels: NutritionLabels["summary"];
};

const summaryFields: (keyof DetailedNutrition)[] = [
  "calories",
  "totalSugars",
  "sodium",
  "saturatedFat",
  "protein",
  "dietaryFibre",
];

const fieldColors: Record<string, { bg: string; text: string }> = {
  calories: { bg: "bg-primary/5 dark:bg-primary/10", text: "text-foreground" },
  totalSugars: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400" },
  sodium: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400" },
  saturatedFat: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400" },
  protein: { bg: "bg-green-50 dark:bg-green-950/40", text: "text-green-700 dark:text-green-400" },
  dietaryFibre: { bg: "bg-green-50 dark:bg-green-950/40", text: "text-green-700 dark:text-green-400" },
};

export function NutritionSummary({ nutrition, labels }: NutritionSummaryProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
          <BarChart3 className="size-5 text-primary" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold text-foreground">{labels.title}</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {summaryFields.map((key) => {
          const field = nutrition[key] ?? {
            label: key,
            value: "—",
            unit: "",
            available: false,
          };
          const colors = fieldColors[key] ?? { bg: "bg-muted/50", text: "text-foreground" };
          return (
            <div
              key={key}
              className={`flex flex-col rounded-xl border border-border p-4 ${colors.bg}`}
            >
              <span className="text-xs text-muted-foreground">{field.label}</span>
              {field.available ? (
                <>
                  <span className={`mt-1 text-xl font-bold ${colors.text}`}>
                    {field.value}
                  </span>
                  <span className="text-xs text-muted-foreground">{field.unit}</span>
                </>
              ) : (
                <span className="mt-1 text-sm text-muted-foreground italic">
                  {labels.notAvailable}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
