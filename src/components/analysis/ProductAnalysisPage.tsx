"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, MessagesSquare, Flame, Sparkles, X } from "lucide-react";
import Link from "next/link";
import type { ProductAnalysisResult } from "@/data/analysis-data";
import { getAnalysisLabels } from "@/data/analysis-labels";
import type { ProductSnapshot } from "@/types/food-safety-assistant";
import { useAuth } from "@/components/AuthProvider";
import { firebaseAddHistory } from "@/lib/firebase/db";
import { ProductHeader } from "./ProductHeader";
import { AssessmentCard } from "./AssessmentCard";
import { FoodGuardScoreCard } from "./FoodGuardScoreCard";
import { PositivePoints } from "./PositivePoints";
import { AttentionPoints } from "./AttentionPoints";
import { IngredientAnalysisSection } from "./IngredientAnalysisSection";
import { NutritionAnalysis } from "./NutritionAnalysis";
import { EvidenceSources } from "./EvidenceSources";
import { AlternativeSuggestions } from "./AlternativeSuggestions";
import { AlternativesSection } from "./AlternativesSection";
import { RegulatorySection } from "./RegulatorySection";
import { RegulatoryComplianceSection } from "./RegulatoryComplianceSection";
import { LegalMetrologySection } from "./LegalMetrologySection";
import { Disclaimer } from "./Disclaimer";
import { AnalysisActions } from "./AnalysisActions";
import { AnalysisLoading } from "./AnalysisLoading";
import { AnalysisError } from "./AnalysisError";
import { ChallengeCompleteDialog } from "@/components/challenges/ChallengeCompleteDialog";
import { analysisCache, analysisCacheKey } from "@/lib/cache/analysis-cache";
import { OfflineIndicator } from "@/components/offline/OfflineIndicator";
import { apiUrl } from "@/lib/network/api-url";
import {
  createScanEventId,
  getFoodGuardAuthHeaders,
  publishGamificationUpdate,
  type GamificationActivityResult,
} from "@/services/gamification.service";
import {
  submitIngredientViewActivity,
  type ChallengeCompletion,
} from "@/services/challenge.service";

type AnalysisPhase = "loading" | "result" | "error";

type ProductAnalysisPageProps = {
  barcode: string;
  ingredients?: string;
  imageUrl?: string;
  productName?: string;
  brand?: string;
  ocrText?: string;
  ocrConfidence?: number | null;
  scanEventId?: string;
  lang?: string;
};

export function ProductAnalysisPage({
  barcode,
  ingredients = "",
  imageUrl = "",
  productName = "",
  brand = "",
  ocrText = "",
  ocrConfidence = null,
  scanEventId: scanEventIdFromQuery,
  lang = "en",
}: ProductAnalysisPageProps) {
  const labels = getAnalysisLabels(lang);
  const { firebaseMode, firebaseUser } = useAuth();
  const [phase, setPhase] = useState<AnalysisPhase>("loading");
  const [product, setProduct] = useState<ProductAnalysisResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [reward, setReward] = useState<GamificationActivityResult | null>(null);
  const [completedChallenge, setCompletedChallenge] = useState<ChallengeCompletion | null>(null);
  const scanEventIdRef = useRef<string | null>(null);
  const scanSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (phase !== "result" || !product || !firebaseMode || !firebaseUser) return;
    void firebaseAddHistory(firebaseUser.uid, {
      productId: product.id || null,
      name: product.name || "Scanned product",
      brand: product.brand || null,
      category: product.category || null,
      barcode: product.barcode || barcode || null,
      score: typeof product.score === "number" ? product.score : null,
      source: "analysis",
      assessment: product.assessment ?? null,
      imageUrl: imageUrl || null,
      analysis: product as unknown as Record<string, unknown>,
    });
  }, [phase, product, firebaseMode, firebaseUser, barcode, imageUrl]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const cacheKey = analysisCacheKey(barcode, productName);

    async function load() {
      setPhase("loading");
       setReward(null);
       setCompletedChallenge(null);
      setProduct(null);
      const trimmedBarcode = barcode.trim();
      const trimmedIngredients = ingredients.trim();
      const trimmedName = productName.trim();
      const trimmedOcrText = ocrText.trim();
      const providedScanEventId = scanEventIdFromQuery?.trim();
      if (!trimmedBarcode && !trimmedIngredients && !trimmedName && !trimmedOcrText) {
        if (!cancelled) setPhase("error");
        return;
      }

      // Serve a cached analysis instantly (SWR), then refresh in the
      // background; a network failure never replaces a cached result.
      let showedCached = false;
      if (cacheKey) {
        const cached = await analysisCache().get(cacheKey);
        if (cancelled) return;
        if (cached) {
          showedCached = true;
          setProduct(cached.result);
          setPhase("result");
        }
      }

      const scanSignature = [
        trimmedBarcode,
        trimmedIngredients,
        trimmedName,
        brand.trim(),
        trimmedOcrText,
        imageUrl,
        providedScanEventId ?? "",
      ].join("|");
      if (scanSignatureRef.current !== scanSignature) {
        scanSignatureRef.current = scanSignature;
        scanEventIdRef.current = providedScanEventId || createScanEventId();
      }
      const scanEventId = providedScanEventId || scanEventIdRef.current || createScanEventId();
      scanEventIdRef.current = scanEventId;

      try {
        const response = await fetch(apiUrl("/api/analyze"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getFoodGuardAuthHeaders(),
          },
          signal: controller.signal,
          body: JSON.stringify({
            barcode: trimmedBarcode || undefined,
            productName: trimmedName || undefined,
            brand: brand.trim() || undefined,
            ingredientsText: trimmedIngredients || undefined,
            ocrText: trimmedOcrText || undefined,
            ocrConfidence:
              typeof ocrConfidence === "number" ? ocrConfidence : undefined,
            imageAvailable: Boolean(imageUrl || trimmedOcrText),
            scan_event_id: providedScanEventId || undefined,
            language: lang === "hi" ? "hi" : "en",
          }),
        });
        const json = (await response.json()) as {
          success: boolean;
          data?: ProductAnalysisResult;
           meta?: {
             gamification?: {
               xp_awarded: number;
               total_xp: number;
               current_streak: number;
               longest_streak: number;
               activity_date: string;
               idempotent: boolean;
              completed_challenges?: Array<{
                challenge_id: string;
                name: string;
                description: string;
                xp_reward: number;
              }>;
             } | null;
           } | null;
          error?: { message?: string } | null;
        };
        if (cancelled) return;
        if (!response.ok || !json.success || !json.data) {
          if (!showedCached) {
            setProduct(null);
            setPhase("error");
          }
          return;
        }
        setProduct(json.data);
        setPhase("result");
        if (cacheKey) void analysisCache().save(cacheKey, json.data);

         const analysisReward = json.meta?.gamification;
         if (analysisReward && !analysisReward.idempotent) {
           setReward({
             xp_awarded: analysisReward.xp_awarded,
             total_xp: analysisReward.total_xp,
             current_streak: analysisReward.current_streak,
             longest_streak: analysisReward.longest_streak,
             activity_date: analysisReward.activity_date,
             idempotent: analysisReward.idempotent,
           });
           if (analysisReward.completed_challenges?.[0]) {
             setCompletedChallenge(analysisReward.completed_challenges[0]);
           }
         }

         // Rewards come from the /api/analyze response itself. The separate
         // self-service product_scan call was removed: it let a client assert a
         // scan and mint XP with no analysis behind it, so that endpoint is now
         // retired server-side. Cached results never award anything.
         if (providedScanEventId && json.meta?.gamification) {
           publishGamificationUpdate({
             total_xp: json.meta.gamification.total_xp,
             current_streak: json.meta.gamification.current_streak,
             longest_streak: json.meta.gamification.longest_streak,
             last_activity_date: json.meta.gamification.activity_date,
           });
         }

         // Ingredient views are a separate, non-scoring activity and still have
         // their own endpoint.
         const freshProduct = json.data;
         if (providedScanEventId && freshProduct.ingredients?.length) {
           void submitIngredientViewActivity(
             freshProduct.id,
             `${scanEventId}:ingredients`,
           )
             .then((viewActivity) => {
               if (!viewActivity.idempotent && viewActivity.completed_challenges[0]) {
                 setCompletedChallenge(viewActivity.completed_challenges[0]);
               }
             })
             .catch(() => {
               // Ingredient challenges are best-effort and never block analysis.
             });
         }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!showedCached) {
          setProduct(null);
          setPhase("error");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [barcode, ingredients, productName, brand, ocrText, ocrConfidence, scanEventIdFromQuery, lang, attempt, imageUrl]);

  const handleTryAgain = useCallback(() => {
    setAttempt((a) => a + 1);
  }, []);

  if (phase === "loading") {
    return (
      <div className="flex min-h-dvh flex-col overflow-x-hidden bg-background">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
            <Link
              href="/scan"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {labels.header.backButton}
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:py-16">
          <AnalysisLoading
            title={labels.loading.title}
            description={labels.loading.description}
            stages={labels.loading.stages}
          />
        </main>
      </div>
    );
  }

  if (phase === "error" || !product) {
    return (
      <div className="flex min-h-dvh flex-col overflow-x-hidden bg-background">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
            <Link
              href="/scan"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {labels.header.backButton}
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:py-16">
          <AnalysisError
            title={labels.error.title}
            description={labels.error.description}
            tryAgainLabel={labels.error.tryAgain}
            viewIngredientsLabel={labels.error.viewIngredients}
            onTryAgain={handleTryAgain}
            onViewIngredients={() => setPhase("result")}
          />
        </main>
      </div>
    );
  }

  const assessmentLabels: Record<string, { label: string; description: string }> = {
    low: { label: labels.assessment.low, description: labels.assessment.lowDescription },
    moderate: { label: labels.assessment.moderate, description: labels.assessment.moderateDescription },
    high: { label: labels.assessment.high, description: labels.assessment.highDescription },
    insufficient: { label: labels.assessment.insufficient, description: labels.assessment.insufficientDescription },
  };

  const assessmentData = assessmentLabels[product.assessment] ?? assessmentLabels.low;

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <Link
            href="/scan"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {labels.header.backButton}
          </Link>
          <h1 className="ml-4 text-sm font-semibold text-foreground">
            {labels.header.title}
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full flex-1 px-4 py-6 sm:px-6 lg:py-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex justify-end">
            <OfflineIndicator />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            {/* Left column — primary analysis */}
            <div className="flex min-w-0 flex-col gap-6">
              <ProductHeader
                name={product.name}
                brand={product.brand}
                category={product.category}
                barcode={product.barcode}
                scanDate={product.scanDate}
                imageUrl={product.imageUrl}
                backButton={labels.header.backButton}
                scanDateLabel={labels.header.scanDate}
              />
              <AssessmentCard
                level={product.assessment}
                label={product.foodguardScore?.rating ?? assessmentData.label}
                description={assessmentData.description}
                score={product.score}
              />
              {product.foodguardScore && (
                <FoodGuardScoreCard
                  foodguardScore={product.foodguardScore}
                  confidenceLabel="Analysis Confidence"
                />
              )}
              <PositivePoints
                title={labels.positive.title}
                points={product.positivePoints}
              />
              <AttentionPoints
                title={labels.attention.title}
                points={product.attentionPoints}
              />
            </div>

            {/* Right column — supporting information */}
            <div className="flex min-w-0 flex-col gap-6">
              {product.nutrition && (
                <NutritionAnalysis
                  title={labels.nutrition.title}
                  labels={{
                    calories: labels.nutrition.calories,
                    sugar: labels.nutrition.sugar,
                    sodium: labels.nutrition.sodium,
                    saturatedFat: labels.nutrition.saturatedFat,
                    totalFat: labels.nutrition.totalFat,
                    salt: labels.nutrition.salt,
                    protein: labels.nutrition.protein,
                    fibre: labels.nutrition.fibre,
                    servingSize: labels.nutrition.servingSize,
                  }}
                  nutrition={product.nutrition}
                  barcode={product.barcode}
                  viewDetailsLabel="View Nutrition Details"
                />
              )}
              {product.regulatoryCompliance && (
                <RegulatoryComplianceSection
                  title={labels.regulatory.title}
                  compliance={product.regulatoryCompliance}
                />
              )}
              {product.regulatory && !product.regulatoryCompliance && (
                <RegulatorySection
                  title={labels.regulatory.title}
                  labels={labels.regulatory}
                  regulatory={product.regulatory}
                />
              )}
              {product.legalMetrology && (
                <LegalMetrologySection result={product.legalMetrology} />
              )}
              <EvidenceSources
                title={labels.evidence.title}
                labels={{
                  sourceType: labels.evidence.sourceType,
                  summary: labels.evidence.summary,
                  viewSource: labels.evidence.viewSource,
                }}
                sources={product.evidenceSources}
              />
              <AlternativeSuggestions
                title={labels.alternatives.title}
                description={labels.alternatives.description}
                copyButton={labels.alternatives.copyButton}
                copiedLabel={labels.alternatives.copied}
                pasteNote={labels.alternatives.pasteNote}
                suggestions={product.alternativeSuggestions}
                ingredientList={product.ingredients.map((i) => i.name)}
              />
              {(product.alternatives && product.alternatives.length > 0) ||
                (product.alternativeCharacteristics &&
                  product.alternativeCharacteristics.length > 0) ? (
                <AlternativesSection
                  title={product.alternatives?.some((a) => a.recommendationType === "better_match") ? "Better Matches For You" : "Similar Products"}
                  labels={{
                    subtitle: product.alternatives?.some((a) => a.recommendationType === "better_match") ? "Products ranked by similarity and your preferences." : "Similar products in the same category.",
                    preferenceMatch: "Preference match",
                    fssaiStatus: "FSSAI status",
                    dataConfidence: "Data confidence",
                    viewDetails: "View details",
                    noAlternatives: "No comparable alternatives found in our database.",
                    lowerThan: "lower than",
                    higherThan: "higher than",
                    similarCategory: "Similar category",
                    fewerConcerns: "Fewer concerns",
                    whatToLookFor: "What to look for",
                    whyMayBeBetter: "Why this may be better",
                  }}
                  alternatives={product.alternatives ?? []}
                  productName={product.name}
                  alternativeCharacteristics={product.alternativeCharacteristics}
                  alternativeCriteria={product.alternativeCriteria}
                  productId={product.id}
                />
              ) : null}
            </div>
          </div>

          {/* Full-width sections */}
          <div className="mt-6 flex flex-col gap-6">
            <IngredientAnalysisSection
              title={labels.ingredients.title}
              labels={{
                function: labels.ingredients.function,
                assessment: labels.ingredients.assessment,
                explanation: labels.ingredients.explanation,
                evidence: labels.ingredients.evidence,
                source: labels.ingredients.source,
                viewDetails: labels.ingredients.viewDetails,
              }}
              ingredients={product.ingredients}
              productBarcode={product.barcode}
            />
            <Disclaimer text={labels.disclaimer} />
            <div className="flex flex-col gap-3">
              <Link
                href={`/assistant?barcode=${encodeURIComponent(product.barcode ?? "")}&product_name=${encodeURIComponent(product.name ?? "")}&brand=${encodeURIComponent(product.brand ?? "")}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-5 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                data-testid="analysis-ask-foodguard"
              >
                <MessagesSquare className="h-4 w-4" />
                Ask FoodGuard AI
              </Link>
              <AnalysisActions
                saveLabel={labels.actions.saveHistory}
                scanLabel={labels.actions.scanAnother}
                searchLabel={labels.actions.searchProducts}
                reportLabel={labels.actions.reportIssue}
                product={snapshotFromProduct(product)}
              />
            </div>
          </div>
        </div>
      </main>

      {completedChallenge && (
        <ChallengeCompleteDialog challenge={completedChallenge} onClose={() => setCompletedChallenge(null)} />
      )}

      {reward && !reward.idempotent && !completedChallenge && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-sidebar/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="foodguard-reward-title"
        >
          <div className="foodguard-card relative w-full max-w-sm bg-card p-7 text-center shadow-xl">
            <button
              type="button"
              onClick={() => setReward(null)}
              className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Close reward"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
              <Sparkles className="size-7" aria-hidden="true" />
            </div>
            <p className="mt-5 text-3xl font-semibold tracking-tight text-primary">
              +{reward.xp_awarded} XP
            </p>
            <h2 id="foodguard-reward-title" className="mt-2 text-lg font-semibold text-foreground">
              Great! Product scanned.
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-xl bg-primary-light/60 p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Flame className="size-3.5 text-primary" aria-hidden="true" />
                  Streak updated
                </div>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {reward.current_streak} {reward.current_streak === 1 ? "day" : "days"}
                </p>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
                  Total XP
                </div>
                <p className="mt-1 text-sm font-semibold text-foreground">{reward.total_xp} XP</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReward(null)}
              className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Map the loaded ProductAnalysisResult into a minimal ProductSnapshot
 * for the Food Safety Assistant deep-link. Missing fields are `null`
 * or omitted — the assistant renders "Not provided" for anything absent.
 */
function snapshotFromProduct(product: ProductAnalysisResult | null): ProductSnapshot | null {
  if (!product) return null;
  return {
    barcode: product.barcode || null,
    name: product.name || null,
    brand: product.brand || null,
    category: product.category || null,
    ingredients: product.ingredients?.map((i) => i.name) ?? [],
    allergens: [],
    nutritionConcerns: product.attentionPoints?.map((p) => `${p.name}: ${p.reason}`).slice(0, 5) ?? [],
    regulatorySummary: product.regulatory
      ? `FSSAI analysis: ${product.regulatory.overallStatus}. Warnings: ${product.regulatory.warnings?.length ?? 0}.`
      : null,
  };
}
