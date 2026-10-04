import { describe, it, expect } from "vitest";
import {
  FoodProfileUnderstandingSchema,
  getAIProvider,
  type FoodProfileUnderstandingInput,
} from "@/lib/ai";

const INPUT: FoodProfileUnderstandingInput = {
  product: { name: "Corn Flakes", brand: "Kellogg's" },
  servingSize: "30g",
  basis: "PER_SERVING",
  nutrition: [
    { key: "sugars", value: 12, unit: "g" },
    { key: "protein", value: 4, unit: "g" },
  ],
  missingNutrition: ["fiber", "sodium"],
  ingredients: ["corn", "sugar", "malt flavor", "salt"],
  hasIngredients: true,
};

describe("food understanding (mock provider, no live LLM)", () => {
  it("returns structured, evidence-grounded understanding", async () => {
    const provider = getAIProvider();
    expect(provider.explainFoodProfile).toBeDefined();
    const out = await provider.explainFoodProfile!(INPUT);
    expect(out.ingredientInsights[0]).toMatchObject({
      type: "added_sugar",
      label: "Contains added sugar",
      evidence: "sugar",
    });
    expect(out.nutritionInsights.map((n) => n.type)).toContain("sugars");
    expect(out.nutritionInsights.find((n) => n.type === "sugars")).toMatchObject({
      value: 12,
      unit: "g",
    });
  });

  it("never invents missing values — reports them unavailable", async () => {
    const out = await getAIProvider().explainFoodProfile!({
      ...INPUT,
      nutrition: [],
      missingNutrition: ["sugars", "protein", "sodium"],
      ingredients: [],
      hasIngredients: false,
    });
    expect(out.nutritionInsights).toEqual([]);
    expect(out.unavailable).toEqual(
      expect.arrayContaining(["sugars", "protein", "sodium", "ingredients"]),
    );
    expect(out.flags).toContain("nutrition_unavailable");
    // No numeric values appear anywhere in labels.
    const labels = [
      ...out.ingredientInsights.map((i) => i.label),
      ...out.nutritionInsights.map((i) => i.label),
    ].join(" ");
    expect(labels).not.toMatch(/\d+\s*(g|mg|kcal)/);
  });

  it("makes no health judgments", async () => {
    const out = await getAIProvider().explainFoodProfile!(INPUT);
    const text = JSON.stringify(out).toLowerCase();
    expect(text).not.toMatch(/healthy|unhealthy|safe|unsafe|good for|bad for|recommend/);
  });
});

describe("FoodProfileUnderstandingSchema (invalid Qwen response handling)", () => {
  it("accepts a well-formed understanding", () => {
    const parsed = FoodProfileUnderstandingSchema.safeParse({
      ingredientInsights: [{ type: "added_sugar", label: "Contains added sugar", evidence: "sugar" }],
      nutritionInsights: [],
      flags: [],
      unavailable: ["fiber"],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects hallucinated/malformed payloads", () => {
    expect(FoodProfileUnderstandingSchema.safeParse(null).success).toBe(false);
    // Free prose without structure degrades to empty defaults (never shown
    // as insights), while wrong types are hard-rejected.
    const prose = FoodProfileUnderstandingSchema.safeParse({ summary: "free prose" });
    expect(prose.success).toBe(true);
    if (prose.success) {
      expect(prose.data.ingredientInsights).toEqual([]);
      expect(prose.data.nutritionInsights).toEqual([]);
    }
    expect(
      FoodProfileUnderstandingSchema.safeParse({
        ingredientInsights: "Contains added sugar", // wrong type
      }).success,
    ).toBe(false);
    expect(
      FoodProfileUnderstandingSchema.safeParse({
        ingredientInsights: [{ type: "added_sugar", label: "Contains added sugar" }], // missing evidence
      }).success,
    ).toBe(false);
    expect(
      FoodProfileUnderstandingSchema.safeParse("Probably around 20g sugar.").success,
    ).toBe(false);
  });
});
