"use client";

import { ArrowLeft } from "lucide-react";
import type { HistoryLabels } from "@/data/history-labels";
import type { ProductAnalysisResult } from "@/data/analysis-data";
import { ProductHeader } from "@/components/analysis/ProductHeader";
import { AssessmentCard } from "@/components/analysis/AssessmentCard";
import { PositivePoints } from "@/components/analysis/PositivePoints";
import { AttentionPoints } from "@/components/analysis/AttentionPoints";
import { IngredientAnalysisSection } from "@/components/analysis/IngredientAnalysisSection";
import { NutritionAnalysis } from "@/components/analysis/NutritionAnalysis";
import { EvidenceSources } from "@/components/analysis/EvidenceSources";
import { AlternativeSuggestions } from "@/components/analysis/AlternativeSuggestions";
import { Disclaimer } from "@/components/analysis/Disclaimer";

type HistoryDetailViewProps = {
  product: ProductAnalysisResult;
  labels: HistoryLabels;
  analysisLabels: {
    assessment: {
      low: string;
      lowDescription: string;
      moderate: string;
      moderateDescription: string;
      high: string;
      highDescription: string;
      insufficient: string;
      insufficientDescription: string;
    };
    positive: { title: string };
    attention: { title: string };
    ingredients: {
      title: string;
      function: string;
      assessment: string;
      explanation: string;
      evidence: string;
      source: string;
      viewDetails: string;
    };
    nutrition: {
      title: string;
      calories: string;
      sugar: string;
      sodium: string;
      saturatedFat: string;
      protein: string;
      fibre: string;
      servingSize: string;
    };
    evidence: { title: string; sourceType: string; summary: string; viewSource: string };
    alternatives: {
      title: string;
      description: string;
      copyButton: string;
      copied: string;
      pasteNote: string;
    };
    disclaimer: string;
  };
  onBack: () => void;
};

export function HistoryDetailView({
  product,
  labels,
  analysisLabels,
  onBack,
}: HistoryDetailViewProps) {
  const level = product.assessment === "high" || product.assessment === "moderate" || product.assessment === "low"
    ? product.assessment
    : "low";
  const assessmentData = {
    label: analysisLabels.assessment[level],
    description: analysisLabels.assessment[`${level}Description`],
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-14 z-30 lg:top-0 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {labels.detail.backButton}
          </button>
          <h1 className="ml-4 text-sm font-semibold text-foreground">
            {labels.detail.title}
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full flex-1 px-4 py-6">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            {/* Left column — primary analysis */}
            <div className="flex flex-col gap-6">
              <ProductHeader
                name={product.name}
                brand={product.brand}
                category={product.category}
                barcode={product.barcode}
                scanDate={product.scanDate}
                imageUrl={product.imageUrl}
                backButton={labels.detail.backButton}
                scanDateLabel={labels.productCard.scanned}
              />
              <AssessmentCard
                level={product.assessment}
                label={assessmentData.label}
                description={assessmentData.description}
                score={product.score}
              />
              <PositivePoints
                title={analysisLabels.positive.title}
                points={product.positivePoints}
              />
              <AttentionPoints
                title={analysisLabels.attention.title}
                points={product.attentionPoints}
              />
            </div>

            {/* Right column — supporting information */}
            <div className="flex flex-col gap-6">
              {product.nutrition && (
                <NutritionAnalysis
                  title={analysisLabels.nutrition.title}
                  labels={{
                    calories: analysisLabels.nutrition.calories,
                    sugar: analysisLabels.nutrition.sugar,
                    sodium: analysisLabels.nutrition.sodium,
                    saturatedFat: analysisLabels.nutrition.saturatedFat,
                    protein: analysisLabels.nutrition.protein,
                    fibre: analysisLabels.nutrition.fibre,
                    servingSize: analysisLabels.nutrition.servingSize,
                  }}
                  nutrition={product.nutrition}
                />
              )}
              <EvidenceSources
                title={analysisLabels.evidence.title}
                labels={{
                  sourceType: analysisLabels.evidence.sourceType,
                  summary: analysisLabels.evidence.summary,
                  viewSource: analysisLabels.evidence.viewSource,
                }}
                sources={product.evidenceSources}
              />
              <AlternativeSuggestions
                title={analysisLabels.alternatives.title}
                description={analysisLabels.alternatives.description}
                copyButton={analysisLabels.alternatives.copyButton}
                copiedLabel={analysisLabels.alternatives.copied}
                pasteNote={analysisLabels.alternatives.pasteNote}
                suggestions={product.alternativeSuggestions}
                ingredientList={product.ingredients.map((i) => i.name)}
              />
            </div>
          </div>

          {/* Full-width sections */}
          <div className="mt-6 flex flex-col gap-6">
            <IngredientAnalysisSection
              title={analysisLabels.ingredients.title}
              labels={{
                function: analysisLabels.ingredients.function,
                assessment: analysisLabels.ingredients.assessment,
                explanation: analysisLabels.ingredients.explanation,
                evidence: analysisLabels.ingredients.evidence,
                source: analysisLabels.ingredients.source,
                viewDetails: analysisLabels.ingredients.viewDetails,
              }}
              ingredients={product.ingredients}
            />
            <Disclaimer text={analysisLabels.disclaimer} />
          </div>
        </div>
      </main>
    </div>
  );
}
