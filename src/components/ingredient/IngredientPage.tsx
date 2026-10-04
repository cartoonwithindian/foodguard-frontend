"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { lookupIngredient } from "@/data/ingredient-data";
import { getIngredientLabels } from "@/data/ingredient-labels";
import { IngredientOverview } from "./IngredientOverview";
import { IngredientDescription } from "./IngredientDescription";
import { IngredientUsage } from "./IngredientUsage";
import { AssessmentExplanation } from "./AssessmentExplanation";
import { EvidenceSection } from "./EvidenceSection";
import { RegulatoryInformation } from "./RegulatoryInformation";
import { ProductContext } from "./ProductContext";
import { DataQuality } from "./DataQuality";
import { RelatedIngredients } from "./RelatedIngredients";
import { IngredientActions } from "./IngredientActions";
import { useSafeBack } from "@/lib/navigation/use-safe-back";

type IngredientPageProps = {
  ingredientId: string;
  productBarcode?: string;
  lang?: string;
};

export function IngredientPage({
  ingredientId,
  productBarcode,
  lang = "en",
}: IngredientPageProps) {
  const router = useRouter();
  const goBack = useSafeBack(
    productBarcode ? `/analysis?barcode=${encodeURIComponent(productBarcode)}` : "/",
  );
  const labels = getIngredientLabels(lang);
  const ingredient = lookupIngredient(ingredientId);

  const handleRelatedClick = (id: string) => {
    router.push(`/ingredient?id=${encodeURIComponent(id)}&product=${encodeURIComponent(productBarcode ?? "")}`);
  };

  if (!ingredient) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
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
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">Ingredient not found.</p>
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
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-5 sm:space-y-5 sm:px-6">
        {/* Desktop: two-column layout */}
        <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-5">
          {/* Left column — main content */}
          <div className="space-y-4 sm:space-y-5">
            <IngredientOverview
              ingredient={ingredient}
              labels={labels.overview}
              assessmentLabels={labels.assessment}
            />

            <IngredientDescription
              description={ingredient.description}
              learnMoreUrl={ingredient.learnMoreUrl}
              labels={labels.whatIsIt}
            />

            <IngredientUsage
              whyUsed={ingredient.whyUsed}
              functionLabel={ingredient.functionLabel}
              labels={labels.whyUsed}
            />

            <AssessmentExplanation
              assessment={ingredient.assessment}
              flagExplanation={ingredient.flagExplanation}
              factorsConsidered={ingredient.factorsConsidered}
              labels={labels.assessment}
            />
          </div>

          {/* Right column — supporting info */}
          <div className="mt-4 space-y-4 sm:mt-5 sm:space-y-5 lg:mt-0">
            <EvidenceSection
              evidence={ingredient.evidence}
              labels={labels.evidence}
            />

            <RegulatoryInformation
              regulatory={ingredient.regulatory}
              labels={labels.regulatory}
            />

            <ProductContext
              context={ingredient.productContext}
              labels={labels.productContext}
            />

            <DataQuality
              dataQuality={ingredient.dataQuality}
              labels={labels.dataQuality}
            />
          </div>
        </div>

        {/* Full-width sections */}
        <RelatedIngredients
          related={ingredient.relatedIngredients}
          labels={labels.related}
          onIngredientClick={handleRelatedClick}
        />

        <IngredientActions
          productBarcode={productBarcode}
          labels={labels.actions}
        />
      </main>
    </div>
  );
}
