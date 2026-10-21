"use client";

import { ArrowLeft, Search, ScanLine } from "lucide-react";
import Link from "next/link";
import type { NutritionLabels } from "@/data/nutrition-labels";

type NutritionActionsProps = {
  barcode: string;
  labels: NutritionLabels["actions"];
};

export function NutritionActions({ barcode, labels }: NutritionActionsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Link
        href={`/analysis?barcode=${encodeURIComponent(barcode)}`}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {labels.backToAnalysis}
      </Link>
      <Link
        href="/search"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <Search className="size-4" aria-hidden="true" />
        {labels.searchAlternatives}
      </Link>
      <Link
        href="/scan"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <ScanLine className="size-4" aria-hidden="true" />
        {labels.scanAnother}
      </Link>
    </div>
  );
}
