/**
 * Multi-Product Scanner — structured food profile contracts (Phase 4).
 *
 * A ProductFoodProfile describes WHAT IS IN a confirmed product:
 * identity → lookup → nutrition + ingredients → AI understanding.
 * No personalization, no scores, no judgments — Phase 5 consumes this.
 *
 * Existing types are reused, not duplicated: NutritionFacts/basis from
 * `@/types/domain`, ingredient parse/normalize from `@/lib/ingredients/*`,
 * unit normalization from `@/lib/nutrition/units`, and the understanding
 * shape from `@/lib/ai` (FoodProfileUnderstanding).
 */
import type { FoodProfileUnderstanding } from "@/lib/ai";
import type { NutritionFacts } from "@/types/domain";
import { normalizeNutritionFacts } from "@/lib/nutrition/units";
import { parseIngredientText } from "@/lib/ingredients/parse";
import { normalizeIngredient } from "@/lib/ingredients/normalize";

/** One nutrient amount — null means "not available" (never 0). */
export type NutrientAmount = { value: number; unit: string } | null;

export type ProfileNutrition = {
  /** Measurement basis, recorded explicitly — never silently converted. */
  basis: "PER_100G" | "PER_SERVING" | null;
  calories: NutrientAmount;
  carbohydrates: NutrientAmount;
  totalSugar: NutrientAmount;
  addedSugar: NutrientAmount;
  protein: NutrientAmount;
  fat: NutrientAmount;
  saturatedFat: NutrientAmount;
  fiber: NutrientAmount;
  sodium: NutrientAmount;
};

export type ProfileStatus =
  | "analyzing"
  | "ready"
  | "data_unavailable"
  | "understanding_failed"
  | "error";

export type ProductFoodProfile = {
  detectionId: string;
  productId: string;
  productName: string;
  brand: string | null;
  image: string | null;
  barcode: string | null;
  servingSize: string | null;
  nutrition: ProfileNutrition;
  ingredients: {
    rawText: string;
    normalized: string[];
  };
  categories: string[];
  understanding: FoodProfileUnderstanding | null;
  /** Which backend produced the understanding (honest attribution). */
  understandingSource: "qwen" | "mock" | "unavailable";
  source: string;
  fetchedAt: number;
  status: ProfileStatus;
  error?: string;
};

/** Nutrient keys in display order with UI labels. */
export const PROFILE_NUTRIENT_ORDER: Array<{
  key: keyof Omit<ProfileNutrition, "basis">;
  label: string;
}> = [
  { key: "calories", label: "Calories" },
  { key: "carbohydrates", label: "Carbohydrates" },
  { key: "totalSugar", label: "Sugar" },
  { key: "addedSugar", label: "Added sugar" },
  { key: "protein", label: "Protein" },
  { key: "fat", label: "Fat" },
  { key: "saturatedFat", label: "Saturated fat" },
  { key: "fiber", label: "Fiber" },
  { key: "sodium", label: "Sodium" },
];

/** Nutrient keys the understanding layer reasons about. */
export const PROFILE_NUTRIENT_KEYS = PROFILE_NUTRIENT_ORDER.map((n) => n.key);

const FACTS_KEY_MAP: Record<string, keyof Omit<ProfileNutrition, "basis">> = {
  calories: "calories",
  carbohydrates: "carbohydrates",
  sugars: "totalSugar",
  addedSugars: "addedSugar",
  protein: "protein",
  totalFat: "fat",
  saturatedFat: "saturatedFat",
  fiber: "fiber",
  sodium: "sodium",
};

/** Map a normalized NutritionFacts into the fixed profile shape. */
export function nutritionFromFacts(facts: NutritionFacts | null): ProfileNutrition {
  const empty: ProfileNutrition = {
    basis: null,
    calories: null,
    carbohydrates: null,
    totalSugar: null,
    addedSugar: null,
    protein: null,
    fat: null,
    saturatedFat: null,
    fiber: null,
    sodium: null,
  };
  if (!facts) return empty;
  let normalized: NutritionFacts;
  try {
    normalized = normalizeNutritionFacts(facts);
  } catch {
    return empty;
  }
  const out: ProfileNutrition = {
    ...empty,
    basis: normalized.basis ?? null,
  };
  for (const [factsKey, profileKey] of Object.entries(FACTS_KEY_MAP)) {
    const nutrient = normalized.nutrients[factsKey];
    if (
      nutrient &&
      typeof nutrient.value === "number" &&
      Number.isFinite(nutrient.value) &&
      typeof nutrient.unit === "string"
    ) {
      out[profileKey] = { value: nutrient.value, unit: nutrient.unit };
    }
  }
  return out;
}

/**
 * Coerce an unknown payload (e.g. IdentifiedProduct.nutrition from the
 * barcode endpoint) into NutritionFacts. Returns null unless the payload
 * genuinely has the NutritionFacts shape — never guesses.
 */
export function coerceNutritionFacts(value: unknown): NutritionFacts | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  if (rec.basis !== "PER_100G" && rec.basis !== "PER_SERVING") return null;
  if (!rec.nutrients || typeof rec.nutrients !== "object") return null;
  const nutrients = rec.nutrients as Record<string, unknown>;
  for (const n of Object.values(nutrients)) {
    if (!n || typeof n !== "object") return null;
    const v = (n as Record<string, unknown>).value;
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
  }
  return {
    servingSize: typeof rec.servingSize === "string" ? rec.servingSize : undefined,
    servingsPerContainer: typeof rec.servingsPerContainer === "string" ? rec.servingsPerContainer : undefined,
    basis: rec.basis,
    nutrients: nutrients as NutritionFacts["nutrients"],
  };
}

/** Keep the raw text AND a normalized list (canonical name or raw entry). */
export function normalizeProfileIngredients(rawText: string): {
  rawText: string;
  normalized: string[];
} {
  const raw = (rawText ?? "").trim();
  if (!raw) return { rawText: "", normalized: [] };
  const { ingredients } = parseIngredientText(raw);
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of ingredients) {
    const n = normalizeIngredient(entry);
    const name = (n.matched && n.canonicalName ? n.canonicalName : entry).trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(name);
  }
  return { rawText: raw, normalized };
}

/** True when the profile has any trusted substance to show/understand. */
export function hasProfileSubstance(profile: Pick<ProductFoodProfile, "nutrition" | "ingredients">): boolean {
  const hasNutrition = Object.entries(profile.nutrition).some(
    ([k, v]) => k !== "basis" && v !== null,
  );
  return hasNutrition || profile.ingredients.normalized.length > 0;
}
