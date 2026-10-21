import { describe, it, expect } from "vitest";
import {
  coerceNutritionFacts,
  hasProfileSubstance,
  normalizeProfileIngredients,
  nutritionFromFacts,
  type ProductFoodProfile,
} from "@/lib/multi-scan/food-profile";
import type { NutritionFacts } from "@/types/domain";

const facts = (nutrients: NutritionFacts["nutrients"], basis: NutritionFacts["basis"] = "PER_100G"): NutritionFacts => ({
  servingSize: "30g",
  basis,
  nutrients,
});

const nv = (value: number, unit: string) => ({ value, unit, confidence: 0.8 });

describe("nutritionFromFacts", () => {
  it("maps a full product into the fixed profile shape with basis", () => {
    const out = nutritionFromFacts(
      facts({
        calories: nv(110, "kcal"),
        carbohydrates: nv(24, "g"),
        sugars: nv(12, "g"),
        protein: nv(4, "g"),
        totalFat: nv(1, "g"),
        saturatedFat: nv(0.2, "g"),
        fiber: nv(2, "g"),
        sodium: nv(320, "mg"),
      }),
    );
    expect(out.basis).toBe("PER_100G");
    expect(out.calories).toEqual({ value: 110, unit: "kcal" });
    expect(out.totalSugar).toEqual({ value: 12, unit: "g" });
    expect(out.addedSugar).toBeNull();
    expect(out.sodium).toEqual({ value: 320, unit: "mg" });
  });

  it("keeps missing nutrients as null, never zero", () => {
    const out = nutritionFromFacts(facts({ calories: nv(50, "kcal") }));
    expect(out.calories).toEqual({ value: 50, unit: "kcal" });
    expect(out.totalSugar).toBeNull();
    expect(out.protein).toBeNull();
    expect(out.sodium).toBeNull();
  });

  it("preserves PER_SERVING basis explicitly", () => {
    const out = nutritionFromFacts(facts({ sugars: nv(24, "g") }, "PER_SERVING"));
    expect(out.basis).toBe("PER_SERVING");
    expect(out.totalSugar).toEqual({ value: 24, unit: "g" });
  });

  it("returns an empty (all-null) profile for null facts", () => {
    const out = nutritionFromFacts(null);
    expect(out.basis).toBeNull();
    expect(out.calories).toBeNull();
  });
});

describe("coerceNutritionFacts", () => {
  it("accepts genuine NutritionFacts payloads", () => {
    const payload = {
      servingSize: "30g",
      basis: "PER_100G",
      nutrients: { sugars: { value: 12, unit: "g", confidence: 0.7 } },
    };
    expect(coerceNutritionFacts(payload)?.basis).toBe("PER_100G");
  });

  it("rejects anything that is not a NutritionFacts shape", () => {
    expect(coerceNutritionFacts(null)).toBeNull();
    expect(coerceNutritionFacts("sugar: 12g")).toBeNull();
    expect(coerceNutritionFacts({ basis: "PER_100G" })).toBeNull();
    expect(coerceNutritionFacts({ basis: "PER_DAY", nutrients: {} })).toBeNull();
    expect(
      coerceNutritionFacts({ basis: "PER_100G", nutrients: { sugars: { value: NaN, unit: "g" } } }),
    ).toBeNull();
    expect(
      coerceNutritionFacts({ basis: "PER_100G", nutrients: { sugars: { value: "12", unit: "g" } } }),
    ).toBeNull();
  });
});

describe("normalizeProfileIngredients", () => {
  it("keeps raw text and a normalized list", () => {
    const out = normalizeProfileIngredients("Corn, sugar, malt flavor, salt");
    expect(out.rawText).toBe("Corn, sugar, malt flavor, salt");
    expect(out.normalized.length).toBeGreaterThan(0);
    expect(out.normalized.join(" ").toLowerCase()).toContain("sugar");
  });

  it("returns empty for missing ingredients", () => {
    expect(normalizeProfileIngredients("")).toEqual({ rawText: "", normalized: [] });
    expect(normalizeProfileIngredients("   ")).toEqual({ rawText: "", normalized: [] });
  });
});

describe("hasProfileSubstance", () => {
  const base: Pick<ProductFoodProfile, "nutrition" | "ingredients"> = {
    nutrition: nutritionFromFacts(null),
    ingredients: { rawText: "", normalized: [] },
  };
  it("is false when nothing trusted exists", () => {
    expect(hasProfileSubstance(base)).toBe(false);
  });
  it("is true with nutrition or ingredients", () => {
    expect(
      hasProfileSubstance({ ...base, nutrition: nutritionFromFacts(facts({ sugars: nv(1, "g") })) }),
    ).toBe(true);
    expect(
      hasProfileSubstance({ ...base, ingredients: { rawText: "Sugar", normalized: ["sugar"] } }),
    ).toBe(true);
  });
});
