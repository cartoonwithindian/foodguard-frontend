"use client";

import { FileText, ExternalLink } from "lucide-react";
import type { NutritionSourceInfo } from "@/data/nutrition-data";
import type { NutritionLabels } from "@/data/nutrition-labels";

type NutritionSourceProps = {
  source?: NutritionSourceInfo;
  labels: NutritionLabels["source"];
};

export function NutritionSource({ source, labels }: NutritionSourceProps) {
  if (!source) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
          <FileText className="size-5 text-primary" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold text-foreground">{labels.title}</h2>
      </div>

      <div className="rounded-xl border border-border bg-background p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{source.sourceName}</p>
            {source.database && (
              <p className="mt-0.5 text-xs text-muted-foreground">Database: {source.database}</p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {source.sourceType}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{source.summary}</p>
        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {labels.viewDetails}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}
