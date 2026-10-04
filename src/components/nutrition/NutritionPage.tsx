"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { NutritionProductDetail } from "@/data/nutrition-data";
import { getNutritionLabels } from "@/data/nutrition-labels";
import { NutritionProductHeader } from "./NutritionProductHeader";
import { NutritionSummary } from "./NutritionSummary";
import { NutritionBreakdown } from "./NutritionBreakdown";
import { ServingInformation } from "./ServingInformation";
import { NutritionAttentionAreas } from "./NutritionAttentionAreas";
import { PositiveNutritionPoints } from "./PositiveNutritionPoints";
import { NutritionContext } from "./NutritionContext";
import { NutritionDataQuality } from "./NutritionDataQuality";
import { NutritionSource } from "./NutritionSource";
import { NutritionActions } from "./NutritionActions";
import { apiUrl } from "@/lib/network/api-url";
import { useSafeBack } from "@/lib/navigation/use-safe-back";

type NutritionPageProps = {
  barcode: string;
  lang?: string;
};

function Header({
  onBack,
  title,
}: {
  onBack: () => void;
  title: string;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {title}
        </button>
      </div>
    </header>
  );
}

export function NutritionPage({ barcode, lang = "en" }: NutritionPageProps) {
  const goBack = useSafeBack(`/analysis?barcode=${encodeURIComponent(barcode)}`);
  const labels = getNutritionLabels(lang);
  const [product, setProduct] = useState<NutritionProductDetail | null>(null);
  const [loading, setLoading] = useState(!!barcode);
  const [error, setError] = useState<string | null>(() => (!barcode ? "No barcode provided." : null));

  useEffect(() => {
    if (!barcode) return;
    let cancelled = false;
    async function fetchNutrition() {
      try {
        const res = await fetch(apiUrl(`/api/nutrition/${encodeURIComponent(barcode)}`));
        if (!res.ok) {
          if (!cancelled) setError("Unable to load nutrition information.");
          return;
        }
        const json = await res.json();
        if (json.success && json.data) {
          if (!cancelled) setProduct(json.data as NutritionProductDetail);
        } else {
          if (!cancelled) setError(json.error ?? "Nutrition data not available for this product.");
        }
      } catch {
        if (!cancelled) setError("Unable to load nutrition information.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchNutrition();
    return () => { cancelled = true; };
  }, [barcode]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header onBack={goBack} title={labels.header.backToAnalysis} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Loading nutrition information…</p>
          </div>
        </main>
      </div>
    );
  }

  /* ── Error or not found ── */
  if (error || !product) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header onBack={goBack} title={labels.header.backToAnalysis} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {error ?? "Nutrition data not available for this product."}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {labels.header.backToAnalysis}
          </button>
          <h1 className="ml-4 text-sm font-semibold text-foreground">
            {labels.header.title}
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-5 sm:space-y-5 sm:px-6">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {labels.header.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {labels.header.subtitle}
          </p>
        </div>

        {/* Product header */}
        <NutritionProductHeader
          product={product}
          labels={labels.product}
        />

        {/* Nutrition Summary */}
        <NutritionSummary
          nutrition={product.nutrition}
          labels={labels.summary}
        />

        {/* Desktop: two-column layout */}
        <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-5">
          {/* Left column */}
          <div className="space-y-4 sm:space-y-5">
            <NutritionBreakdown
              nutrition={product.nutrition}
              labels={labels.breakdown}
            />

            <ServingInformation
              servingSize={product.servingSize}
              servingsPerContainer={product.servingsPerContainer}
              labels={labels.serving}
            />
          </div>

          {/* Right column */}
          <div className="mt-4 space-y-4 sm:mt-5 sm:space-y-5 lg:mt-0">
            <NutritionAttentionAreas
              areas={product.attentionAreas}
              labels={labels.attention}
            />

            <PositiveNutritionPoints
              points={product.positivePoints}
              labels={labels.positive}
            />

            <NutritionContext
              context={product.context}
              labels={labels.context}
            />
          </div>
        </div>

        {/* Full-width sections */}
        <NutritionDataQuality
          level={product.dataQuality}
          explanation={product.dataQualityExplanation}
          labels={labels.dataQuality}
        />

        <NutritionSource
          source={product.source}
          labels={labels.source}
        />

        <NutritionActions
          barcode={product.barcode}
          labels={labels.actions}
        />
      </main>
    </div>
  );
}
