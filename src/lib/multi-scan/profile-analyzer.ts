/**
 * Multi-Product Scanner — food-profile analyzer (Phase 4).
 *
 *   confirmed identity → product lookup → nutrition + ingredients →
 *   structured profile → AI understanding (only when data exists).
 *
 * Each product is analyzed independently: one failure never stops the
 * others. Qwen is invoked only when trusted substance exists (never just
 * for generic prose). Results are cached by confirmed productId —
 * product-level data only, no user-specific decisions.
 */
"use client";

import {
  PROFILE_NUTRIENT_KEYS,
  hasProfileSubstance,
  normalizeProfileIngredients,
  nutritionFromFacts,
  type ProductFoodProfile,
} from "./food-profile";
import {
  lookupConfirmedProduct,
  type ConfirmedLookupInput,
} from "./profile-lookup";
import { fetchFoodUnderstanding } from "./food-understanding";
import { withTimeout } from "./with-timeout";
import type { FoodProfileUnderstandingInput } from "@/lib/ai";

export type AnalysisInput = {
  detectionId: string;
  /** Confirmed FAISS identity (trusted). */
  productId: string;
  /** Confirmed display name (trusted). */
  productName: string;
  image?: string;
};

export type AnalysisProgress = {
  completed: number;
  total: number;
  profiles: ProductFoodProfile[];
};

export type AnalyzerDeps = {
  lookup?: typeof lookupConfirmedProduct;
  understand?: typeof fetchFoodUnderstanding;
};

/** Per-product budget for lookup + understanding. */
const ANALYSIS_PRODUCT_TIMEOUT_MS = 90_000;

// Product-level cache (productId → finished profile). Ready and
// data-unavailable results are stable; understanding failures stay
// retryable and are never cached.
const profileCache = new Map<string, ProductFoodProfile>();

/** Clear the product-profile cache — tests only. */
export function resetProfileCacheForTesting(): void {
  profileCache.clear();
}

export class FoodProfileAnalyzer {
  readonly name = "food-profile-analyzer";
  private readonly lookup: typeof lookupConfirmedProduct;
  private readonly understand: typeof fetchFoodUnderstanding;

  constructor(deps: AnalyzerDeps = {}) {
    this.lookup = deps.lookup ?? lookupConfirmedProduct;
    this.understand = deps.understand ?? fetchFoodUnderstanding;
  }

  async analyze(
    inputs: AnalysisInput[],
    onProgress?: (p: AnalysisProgress) => void,
  ): Promise<ProductFoodProfile[]> {
    const profiles: ProductFoodProfile[] = [];
    for (const input of inputs) {
      profiles.push(await this.analyzeOne(input));
      onProgress?.({ completed: profiles.length, total: inputs.length, profiles: [...profiles] });
    }
    return profiles;
  }

  private async analyzeOne(input: AnalysisInput): Promise<ProductFoodProfile> {
    const cached = profileCache.get(input.productId);
    if (cached && (cached.status === "ready" || cached.status === "data_unavailable")) {
      return { ...cached, detectionId: input.detectionId };
    }

    const base = {
      detectionId: input.detectionId,
      productId: input.productId,
      productName: input.productName,
      fetchedAt: Date.now(),
    };

    try {
      const lookupInput: ConfirmedLookupInput = {
        detectionId: input.detectionId,
        confirmedProductId: input.productId,
        confirmedProductName: input.productName,
      };
      const found = await withTimeout(
        this.lookup(lookupInput),
        ANALYSIS_PRODUCT_TIMEOUT_MS,
        "Product lookup timed out",
      );
      if (!found.ok) {
        return {
          ...base,
          brand: null,
          image: input.image ?? null,
          barcode: null,
          servingSize: null,
          nutrition: nutritionFromFacts(null),
          ingredients: { rawText: "", normalized: [] },
          categories: [],
          understanding: null,
          understandingSource: "unavailable",
          source: "none",
          status: "error",
          error: found.message,
        };
      }

      const nutrition = nutritionFromFacts(found.nutrition);
      const ingredients = normalizeProfileIngredients(found.product.ingredientsRaw);
      const profile: ProductFoodProfile = {
        ...base,
        // Authoritative looked-up identity (falls back to confirmed name).
        productName: found.product.name || input.productName,
        brand: found.product.brand,
        image: found.product.imageUrl ?? input.image ?? null,
        barcode: found.product.barcode,
        servingSize: found.servingSize ?? found.nutrition?.servingSize ?? null,
        nutrition,
        ingredients,
        categories: found.product.category ? [found.product.category] : [],
        understanding: null,
        understandingSource: "unavailable",
        source: found.source,
        status: "analyzing",
      };

      // No trusted substance → honest dead-end, no Qwen call.
      if (!hasProfileSubstance(profile)) {
        const unavailable: ProductFoodProfile = {
          ...profile,
          status: "data_unavailable",
          error: "Nutrition information unavailable.",
        };
        profileCache.set(input.productId, unavailable);
        return unavailable;
      }

      const understandingInput: FoodProfileUnderstandingInput = {
        product: { name: profile.productName, brand: profile.brand },
        servingSize: profile.servingSize,
        basis: profile.nutrition.basis,
        nutrition: PROFILE_NUTRIENT_KEYS.flatMap((key) => {
          const n = profile.nutrition[key];
          return n ? [{ key, value: n.value, unit: n.unit }] : [];
        }),
        missingNutrition: PROFILE_NUTRIENT_KEYS.filter((key) => !profile.nutrition[key]),
        ingredients: profile.ingredients.normalized,
        hasIngredients: profile.ingredients.normalized.length > 0,
      };
      const understood = await withTimeout(
        this.understand(understandingInput),
        ANALYSIS_PRODUCT_TIMEOUT_MS,
        "Food understanding timed out",
      );

      if (!understood.ok) {
        // Raw data stays accessible; only the AI layer failed.
        return {
          ...profile,
          status: "understanding_failed",
          error: "AI ingredient interpretation unavailable.",
        };
      }
      const ready: ProductFoodProfile = {
        ...profile,
        status: "ready",
        understanding: understood.understanding,
        understandingSource: understood.source,
      };
      profileCache.set(input.productId, ready);
      return ready;
    } catch (err: unknown) {
      return {
        ...base,
        brand: null,
        image: input.image ?? null,
        barcode: null,
        servingSize: null,
        nutrition: nutritionFromFacts(null),
        ingredients: { rawText: "", normalized: [] },
        categories: [],
        understanding: null,
        understandingSource: "unavailable",
        source: "none",
        status: "error",
        error: err instanceof Error ? err.message : "Analysis failed unexpectedly.",
      };
    }
  }
}

let sharedAnalyzer: FoodProfileAnalyzer | null = null;

export function getSharedFoodProfileAnalyzer(): FoodProfileAnalyzer {
  sharedAnalyzer ??= new FoodProfileAnalyzer();
  return sharedAnalyzer;
}
