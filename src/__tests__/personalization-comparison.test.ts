import { describe, it, expect, beforeEach } from "vitest";
import { compareProducts } from "@/lib/personalization/comparison";
import {
  PersonalDecisionEngine,
  resetDecisionCacheForTesting,
} from "@/lib/personalization/decision-engine";
import type { JEVAdapter } from "@/lib/personalization/jev-adapter";
import { buildUserFoodContext, type UserFoodContext } from "@/lib/personalization/user-context";
import { defaultDailyTargets } from "@/lib/personalization/daily-targets";
import type { ProductFoodProfile } from "@/lib/multi-scan/food-profile";

const adapter: JEVAdapter = {
  interpret: async () => ({
    ok: true,
    interpretation: {
      explanation: "Contextual note.",
      priorityFactors: [],
      evidence: [],
      uncertainties: [],
    },
    source: "mock",
  }),
};

function product(
  id: string,
  name: string,
  nutrition: { sugar: number; protein?: number | null; fiber?: number | null },
  basis: "PER_100G" | "PER_SERVING" = "PER_100G",
): ProductFoodProfile {
  return {
    detectionId: `d-${id}`,
    productId: id,
    productName: name,
    brand: null,
    image: null,
    barcode: null,
    servingSize: basis === "PER_100G" ? "30g" : "30g",
    nutrition: {
      basis,
      calories: { value: 100, unit: "kcal" },
      carbohydrates: null,
      totalSugar: { value: nutrition.sugar, unit: "g" },
      addedSugar: null,
      protein:
        nutrition.protein == null ? null : { value: nutrition.protein, unit: "g" },
      fat: null,
      saturatedFat: null,
      fiber:
        nutrition.fiber == null ? null : { value: nutrition.fiber, unit: "g" },
      sodium: null,
    },
    ingredients: { rawText: "Corn", normalized: ["Corn"] },
    categories: ["food"],
    understanding: null,
    understandingSource: "unavailable",
    source: "test",
    fetchedAt: 1,
    status: "ready",
  };
}

const dayCtx = (goals: string[] = ["lower_sugar"]): UserFoodContext =>
  buildUserFoodContext({
    prefs: { healthGoals: goals },
    today: { available: true, date: "2026-09-28", consumedFoods: [], consumedNutrition: {} },
    dailyTargets: defaultDailyTargets(),
  });

describe("multi-product comparison (Step 14)", () => {
  beforeEach(() => resetDecisionCacheForTesting());

  async function decideAll(profiles: ProductFoodProfile[], goals = ["lower_sugar"]) {
    const engine = new PersonalDecisionEngine({ jev: adapter });
    const ctx = dayCtx(goals);
    return Promise.all(profiles.map((p) => engine.decide(p, ctx, { force: true })));
  }

  it("case 16 — builds a row per nutrient with per-product values", async () => {
    const decisions = await decideAll([
      product("A", "A", { sugar: 80, protein: 40 }),
      product("B", "B", { sugar: 27, protein: 90 }),
    ]);
    const cmp = compareProducts(decisions, dayCtx());
    expect(cmp.columns.map((c) => c.productName)).toEqual(["A", "B"]);
    const sugarRow = cmp.rows.find((r) => r.key === "totalSugar")!;
    expect(sugarRow.values).toEqual([24, 8.1]);
    expect(sugarRow.unit).toBe("g");
  });

  it("ranks only against an explicit user goal", async () => {
    const decisions = await decideAll([
      product("A", "A", { sugar: 80 }),
      product("B", "B", { sugar: 27 }),
    ]);
    const cmp = compareProducts(decisions, dayCtx(["lower_sugar"]));
    expect(cmp.goalCriterion).toBe("lower_sugar");
    // 27g/100g × 30g = 8.1g is lower than 24g.
    expect(cmp.bestForGoalProductId).toBe("B");
  });

  it("case 16 — names no winner when the user has set no goal", async () => {
    const decisions = await decideAll(
      [product("A", "A", { sugar: 80 }), product("B", "B", { sugar: 27 })],
      [],
    );
    const cmp = compareProducts(decisions, dayCtx([]));
    expect(cmp.goalCriterion).toBeNull();
    expect(cmp.bestForGoalProductId).toBeNull();
    expect(cmp.note).toMatch(/not ranking/i);
  });

  it("never ranks a product that violates a stored restriction", async () => {
    const conflictCtx = buildUserFoodContext({
      prefs: { healthGoals: ["lower_sugar"], avoidIngredients: ["corn"] },
      today: { available: true, date: "d", consumedFoods: [], consumedNutrition: {} },
      dailyTargets: defaultDailyTargets(),
    });
    const engine = new PersonalDecisionEngine({ jev: adapter });
    // A has the lowest sugar but contains "Corn", which the user avoids.
    const conflicting = product("A", "A", { sugar: 10 });
    const fine = { ...product("B", "B", { sugar: 80 }), ingredients: { rawText: "Rice", normalized: ["Rice"] } };
    const decisions = await Promise.all([
      engine.decide(conflicting, conflictCtx, { force: true }),
      engine.decide(fine, conflictCtx, { force: true }),
    ]);
    expect(decisions[0].hardConstraintViolation).toBe(true);
    const cmp = compareProducts(decisions, conflictCtx);
    expect(cmp.conflictingProductIds).toEqual(["A"]);
    expect(cmp.bestForGoalProductId).toBe("B");
  });

  it("reports a tie instead of picking arbitrarily", async () => {
    const decisions = await decideAll([
      product("A", "A", { sugar: 30 }),
      product("B", "B", { sugar: 30 }),
    ]);
    const cmp = compareProducts(decisions, dayCtx());
    const sugarRow = cmp.rows.find((r) => r.key === "totalSugar")!;
    expect(sugarRow.tied).toBe(true);
    expect(sugarRow.bestIndex).toBeNull();
    expect(cmp.bestForGoalProductId).toBeNull();
  });

  it("marks a nutrient unavailable for every product when none report it", async () => {
    const decisions = await decideAll([
      product("A", "A", { sugar: 30 }),
      product("B", "B", { sugar: 30 }),
    ]);
    const cmp = compareProducts(decisions, dayCtx());
    const fiberRow = cmp.rows.find((r) => r.key === "fiber")!;
    expect(fiberRow.values).toEqual([null, null]);
    expect(fiberRow.bestIndex).toBeNull();
    expect(fiberRow.unavailableReason).toBe("product_nutrition_missing");
  });

  it("knows that lower is better for sugar and higher for protein", async () => {
    const decisions = await decideAll([
      product("A", "A", { sugar: 80, protein: 10 }),
      product("B", "B", { sugar: 27, protein: 90 }),
    ]);
    const cmp = compareProducts(decisions, dayCtx());
    expect(cmp.rows.find((r) => r.key === "totalSugar")!.betterDirection).toBe("lower");
    expect(cmp.rows.find((r) => r.key === "protein")!.betterDirection).toBe("higher");
  });

  it("handles a four-product shelf", async () => {
    const decisions = await decideAll([
      product("A", "A", { sugar: 80, protein: 40 }),
      product("B", "B", { sugar: 27, protein: 90 }),
      product("C", "C", { sugar: 40, protein: 70 }),
      product("D", "D", { sugar: 10, protein: 20 }),
    ]);
    const cmp = compareProducts(decisions, dayCtx(["lower_sugar"]));
    expect(cmp.columns).toHaveLength(4);
    expect(cmp.bestForGoalProductId).toBe("D");
  });
});
