"use client";

import { useState } from "react";
import { ChevronDown, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { IngredientAnalysis, AssessmentLevel } from "@/data/analysis-data";

type IngredientAnalysisSectionProps = {
  title: string;
  labels: {
    function: string;
    assessment: string;
    explanation: string;
    evidence: string;
    source: string;
    viewDetails: string;
  };
  ingredients: IngredientAnalysis[];
  productBarcode?: string;
};

const ASSESSMENT_STYLES: Record<
  AssessmentLevel,
  { badge: string; dot: string; label: string }
> = {
  low: { badge: "bg-green-50 text-green-800", dot: "bg-green-600", label: "Low" },
  moderate: {
    badge: "bg-amber-50 text-amber-800",
    dot: "bg-amber-600",
    label: "Attention",
  },
  high: { badge: "bg-rose-50 text-rose-700", dot: "bg-rose-500", label: "High Attention" },
  insufficient: {
    badge: "bg-gray-50 text-gray-600 dark:bg-gray-900/40 dark:text-gray-400",
    dot: "bg-gray-400",
    label: "Insufficient Data",
  },
};

function IngredientCard({
  ingredient,
  labels,
  productBarcode,
}: {
  ingredient: IngredientAnalysis;
  labels: IngredientAnalysisSectionProps["labels"];
  productBarcode?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const style = ASSESSMENT_STYLES[ingredient.assessment];

  return (
    <div className="foodguard-card overflow-hidden rounded-xl">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("size-2 rounded-full shrink-0", style.dot)} />
          <span className="text-sm font-medium text-foreground truncate">
            {ingredient.name}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              style.badge,
            )}
          >
            <span className={cn("size-1.5 rounded-full", style.dot)} />
            {style.label}
          </span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-border px-4 py-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {labels.function}
            </p>
            <p className="mt-1 text-sm text-foreground">{ingredient.function}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {labels.explanation}
            </p>
            <p className="mt-1 text-sm text-foreground leading-relaxed">
              {ingredient.explanation}
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {labels.evidence}
            </p>
            <p className="mt-1 text-sm text-foreground leading-relaxed">
              {ingredient.evidence}
            </p>
            {ingredient.source && (
              <p className="mt-1 text-xs text-muted-foreground">
                Source: {ingredient.source}
              </p>
            )}
          </div>
          <Link
            href={`/ingredient?id=${encodeURIComponent(ingredient.name.toLowerCase().replace(/\s+/g, "-").replace(/[()]/g, ""))}&product=${encodeURIComponent(productBarcode ?? "")}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {labels.viewDetails}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}

export function IngredientAnalysisSection({
  title,
  labels,
  ingredients,
  productBarcode,
}: IngredientAnalysisSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <div className="flex flex-col gap-2">
        {ingredients.map((ing, index) => (
          <IngredientCard
            key={`${ing.name}-${index}`}
            ingredient={ing}
            labels={labels}
            productBarcode={productBarcode}
          />
        ))}
      </div>
    </div>
  );
}
