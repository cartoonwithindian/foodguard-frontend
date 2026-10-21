import { describe, it, expect } from "vitest";
import {
  analyzeContext,
  parseServingGrams,
  type NutrientImpact,
} from "@/lib/personalization/context-engine";
import {
  buildUserFoodContext,
  emptyUserFoodContext,
  type ConsumedFood,
  type TodayIntake,
  type UserFoodContext,
} from "@/lib/personalization/user-context";
import { defaultDailyTargets, resolveDailyTargets } from "@/lib/personalization/daily-targets";
import type { ProductFoodProfile } from "@/lib/multi-scan/food-profile";

// ── Fixtures ────────────────────────────────────────────────────────────

function profile(overrides: Partial<ProductFoodProfile> = {}): ProductFoodProfile {
  return {
    detectionId: "d1",
    productId: "p1",
    productName: "Corn Flakes",
    brand: "Kellogg's",
    image: null,
    barcode: "123",
    servingSize: "30g",
    nutrition: {
      basis: "PER_100G",
      calories: { value: 110, unit: "kcal" },
      carbohydrates: { value: 24, unit: "g" },
      totalSugar: { value: 80, unit: "g" }, // per 100g → 24g per 30g serving
      addedSugar: null,
      protein: { value: 13, unit: "g" }, // → 3.9g per 30g
      fat: null,
      saturatedFat: null,
      fiber: { value: 10, unit: "g" },
      sodium: { value: 1067, unit: "mg" },
    },
    ingredients: { rawText: "Corn, sugar, salt", normalized: ["Corn", "Sugar", "Salt"] },
    categories: ["food"],
    understanding: null,
    understandingSource: "unavailable",
    source: "test",
    fetchedAt: 1,
    status: "ready",
    ...overrides,
  };
}

const emptyToday: TodayIntake = {
  available: true,
  date: "2026-09-28",
  consumedFoods: [],
  consumedNutrition: {},
};

function ctxWithToday(totals: Partial<Record<string, number>>): UserFoodContext {
  // A real daily log that reports intake also has the corresponding logged
  // food(s); the engine treats "food logged but nutrient absent" as unknown,
  // so the fixture must be internally consistent.
  const foods: ConsumedFood[] = Object.keys(totals).length
    ? [
        {
          productId: "prev",
          productName: "Earlier food",
          at: 1,
          servings: 1,
          nutrients: totals as ConsumedFood["nutrients"],
        },
      ]
    : [];
  return buildUserFoodContext({
    prefs: { healthGoals: ["lower_sugar"] },
    today: { available: true, date: "2026-09-28", consumedFoods: foods, consumedNutrition: totals },
    dailyTargets: defaultDailyTargets(),
  });
}

const sugarImpact = (impacts: NutrientImpact[]) => impacts.find((i) => i.key === "totalSugar")!;

// ── parseServingGrams ───────────────────────────────────────────────────

describe("parseServingGrams", () => {
  it("parses gram servings in the shapes products actually use", () => {
    expect(parseServingGrams("30g")).toBe(30);
    expect(parseServingGrams("30 g")).toBe(30);
    expect(parseServingGrams("1 cup (30g)")).toBe(30);
    expect(parseServingGrams("25 grams")).toBe(25);
    expect(parseServingGrams("12.5g")).toBe(12.5);
  });

  it("refuses to guess when there is no gram weight", () => {
    expect(parseServingGrams(null)).toBeNull();
    expect(parseServingGrams("1 cup")).toBeNull();
    expect(parseServingGrams("1 serving")).toBeNull();
    expect(parseServingGrams("0g")).toBeNull();
    expect(parseServingGrams("9999g")).toBeNull();
  });
});

// ── Cases 1–5: the arithmetic ───────────────────────────────────────────

describe("deterministic context calculations", () => {
  it("case 1 — product with an empty day: full budget is remaining", () => {
    const a = analyzeContext(profile(), ctxWithToday({}));
    const s = sugarImpact(a.impacts);
    expect(s.productAmount).toBe(24); // 80g/100g × 30g
    expect(s.consumedBefore).toBe(0);
    expect(s.target).toBe(50);
    expect(s.remainingBefore).toBe(50);
    expect(s.remainingAfter).toBe(26);
    expect(s.shareOfRemaining).toBe(0.48);
  });

  it("case 2 — product with existing intake: remaining shrinks first", () => {
    const a = analyzeContext(profile(), ctxWithToday({ totalSugar: 20 }));
    const s = sugarImpact(a.impacts);
    expect(s.consumedBefore).toBe(20);
    expect(s.remainingBefore).toBe(30);
    expect(s.remainingAfter).toBe(6);
  });

  it("case 3 — remaining target calculation matches the spec example exactly", () => {
    // Spec: 24g sugar, 20g consumed, 50g target → remaining 30g.
    const a = analyzeContext(profile(), ctxWithToday({ totalSugar: 20 }));
    expect(sugarImpact(a.impacts).remainingBefore).toBe(30);
  });

  it("case 4 — product contribution is a share of the REMAINING budget, not of the target", () => {
    // 24g product, 20g consumed, 50g target → 24/30 = 80%.
    const a = analyzeContext(profile(), ctxWithToday({ totalSugar: 20 }));
    expect(sugarImpact(a.impacts).shareOfRemaining).toBe(0.8);
    // Explicitly NOT 24/50.
    expect(sugarImpact(a.impacts).shareOfRemaining).not.toBe(0.48);
  });

  it("case 5 — after-product calculation subtracts the serving from remaining", () => {
    const a = analyzeContext(profile(), ctxWithToday({ totalSugar: 20 }));
    const s = sugarImpact(a.impacts);
    expect(s.remainingAfter).toBe(s.remainingBefore! - s.productAmount!);
    expect(s.remainingAfter).toBe(6);
  });

  it("converts units before comparing (960mg sodium ≠ 0.96mg)", () => {
    // Regression guard: the existing units.ts bug that produced a bogus
    // "sodium 100% lower" must not reappear in the context engine.
    const p = profile({
      servingSize: "100g",
      nutrition: {
        ...profile().nutrition,
        basis: "PER_100G",
        totalSugar: null,
        sodium: { value: 0.96, unit: "g" }, // 0.96 g === 960 mg
      },
    });
    const a = analyzeContext(p, ctxWithToday({}));
    const na = a.impacts.find((i) => i.key === "sodium")!;
    expect(na.productAmount).toBe(960);
    expect(na.unit).toBe("mg");
  });

  it("handles PER_SERVING basis without needing a serving weight", () => {
    const p = profile({
      servingSize: null,
      nutrition: { ...profile().nutrition, basis: "PER_SERVING", totalSugar: { value: 24, unit: "g" } },
    });
    const a = analyzeContext(p, ctxWithToday({ totalSugar: 20 }));
    expect(sugarImpact(a.impacts).productAmount).toBe(24);
    expect(sugarImpact(a.impacts).remainingAfter).toBe(6);
  });

  it("reports a negative remaining value when the budget is already spent", () => {
    const a = analyzeContext(profile(), ctxWithToday({ totalSugar: 55 }));
    const s = sugarImpact(a.impacts);
    expect(s.remainingBefore).toBe(-5);
    expect(s.remainingAfter).toBe(-29);
    // A share of an exhausted budget is meaningless, not negative.
    expect(s.shareOfRemaining).toBeNull();
  });
});

// ── Cases 8–9: missing data degrades honestly ───────────────────────────

describe("missing data never becomes zero", () => {
  it("case 8 — missing product nutrition yields unavailable, not 0", () => {
    const p = profile({
      nutrition: { ...profile().nutrition, totalSugar: null, protein: null },
    });
    const a = analyzeContext(p, ctxWithToday({ totalSugar: 20 }));
    const s = sugarImpact(a.impacts);
    expect(s.productAmount).toBeNull();
    expect(s.remainingAfter).toBeNull();
    expect(s.shareOfRemaining).toBeNull();
    expect(s.unavailableReason).toBe("product_nutrition_missing");
  });

  it("refuses per-serving math when a PER_100G product has no serving size", () => {
    const p = profile({ servingSize: null });
    const a = analyzeContext(p, ctxWithToday({}));
    const s = sugarImpact(a.impacts);
    expect(s.productAmount).toBeNull();
    expect(s.unavailableReason).toBe("basis_unavailable");
    expect(a.uncertainties.some((u) => /serving size/i.test(u))).toBe(true);
  });

  it("case 9 — missing user context does not pretend the day is empty", () => {
    const ctx = buildUserFoodContext({
      prefs: { healthGoals: ["lower_sugar"] },
      dailyTargets: defaultDailyTargets(),
      // today.available === false (the default)
    });
    const a = analyzeContext(profile(), ctx);
    expect(a.todayAvailable).toBe(false);
    const s = sugarImpact(a.impacts);
    expect(s.consumedBefore).toBeNull();
    expect(s.remainingBefore).toBeNull();
    expect(s.shareOfRemaining).toBeNull();
    expect(a.uncertainties.some((u) => /food context is unavailable/i.test(u))).toBe(true);
  });

  it("produces an honest UNKNOWN fit when nothing is comparable", () => {
    const ctx = buildUserFoodContext({ prefs: { healthGoals: ["lower_sugar"] } });
    const a = analyzeContext(profile(), ctx);
    expect(a.fit).toBe("UNKNOWN");
  });

  it("distinguishes 'nothing logged today' (0) from 'logged but nutrient unreported' (unknown)", () => {
    // No food logged at all → a genuine zero.
    const emptyDay = analyzeContext(
      profile(),
      buildUserFoodContext({
        prefs: { healthGoals: ["lower_sugar"] },
        today: { available: true, date: "d", consumedFoods: [], consumedNutrition: {} },
        dailyTargets: defaultDailyTargets(),
      }),
    );
    expect(sugarImpact(emptyDay.impacts).consumedBefore).toBe(0);

    // Food logged, but it reported no sugar → intake is unknown, not zero.
    const unreported = analyzeContext(
      profile(),
      buildUserFoodContext({
        prefs: { healthGoals: ["lower_sugar"] },
        today: {
          available: true,
          date: "d",
          consumedFoods: [
            { productId: "x", productName: "Rice", at: 1, servings: 1, nutrients: { protein: 3 } },
          ],
          consumedNutrition: { protein: 3 },
        },
        dailyTargets: defaultDailyTargets(),
      }),
    );
    expect(sugarImpact(unreported.impacts).consumedBefore).toBeNull();
    expect(sugarImpact(unreported.impacts).remainingBefore).toBeNull();
  });
});

// ── Fit determinism ─────────────────────────────────────────────────────

describe("deterministic fit bands", () => {
  it("flags LOW when the product would exceed a limit today", () => {
    const a = analyzeContext(profile(), ctxWithToday({ totalSugar: 40 }));
    expect(sugarImpact(a.impacts).exceedsTarget).toBe(true);
    expect(["LOW", "MEDIUM"]).toContain(a.fit);
  });

  it("does not report CONFLICT for a product that violates nothing", () => {
    const a = analyzeContext(profile(), ctxWithToday({ totalSugar: 20 }));
    expect(a.hardConstraintViolation).toBe(false);
    expect(a.fit).not.toBe("CONFLICT");
  });

  it("is a pure function of profile + context", () => {
    const p = profile();
    const c = ctxWithToday({ totalSugar: 20 });
    expect(analyzeContext(p, c)).toEqual(analyzeContext(p, c));
  });
});

// ── Targets ─────────────────────────────────────────────────────────────

describe("daily targets", () => {
  it("reuses the app's own WHO reference guidance", () => {
    const t = defaultDailyTargets();
    expect(t.values.totalSugar?.amount).toBe(50);
    expect(t.values.sodium?.amount).toBe(2000);
    expect(t.values.protein?.amount).toBe(50);
    expect(t.values.fiber?.amount).toBe(25);
    expect(t.values.totalSugar?.source).toMatch(/WHO/);
  });

  it("lets a user-set target win, and ignores an invalid one", () => {
    const t = resolveDailyTargets({
      values: { totalSugar: { amount: 30, unit: "g", source: "user" } },
    });
    expect(t.values.totalSugar?.amount).toBe(30);
    expect(t.values.totalSugar?.source).toBe("user");

    const bad = resolveDailyTargets({
      values: { totalSugar: { amount: -5, unit: "g", source: "user" } },
    });
    expect(bad.values.totalSugar?.amount).toBe(50);
  });

  it("marks a nutrient with no app target as no_target", () => {
    const ctx = buildUserFoodContext({
      prefs: { healthGoals: ["lower_sugar"] },
      today: { available: true, date: "d", consumedFoods: [], consumedNutrition: {} },
      dailyTargets: { values: {} },
    });
    const a = analyzeContext(profile(), ctx);
    expect(sugarImpact(a.impacts).unavailableReason).toBe("no_target");
  });
});

// ── User context projection ─────────────────────────────────────────────

describe("user context reuses existing preferences without inventing any", () => {
  it("projects the app's existing UserPreferencesInput verbatim", () => {
    const ctx = buildUserFoodContext({
      prefs: {
        vegan: true,
        allergies: ["peanuts"],
        avoidIngredients: ["palm oil"],
        healthGoals: ["higher_protein"],
        preferredIngredients: ["oats"],
      },
    });
    expect(ctx.restrictions.vegan).toBe(true);
    expect(ctx.restrictions.allergies).toEqual(["peanuts"]);
    expect(ctx.restrictions.avoidIngredients).toEqual(["palm oil"]);
    expect(ctx.goals.healthGoals).toEqual(["higher_protein"]);
    expect(ctx.preferences.preferredIngredients).toEqual(["oats"]);
  });

  it("produces an empty context with no stored profile", () => {
    const ctx = emptyUserFoodContext();
    expect(ctx.profile.hasProfile).toBe(false);
    expect(ctx.goals.hasGoals).toBe(false);
    expect(ctx.today.available).toBe(false);
  });

  it("never infers a goal or restriction the user did not select", () => {
    const ctx = buildUserFoodContext({ prefs: {} });
    expect(ctx.goals.healthGoals).toEqual([]);
    expect(ctx.restrictions.allergies).toEqual([]);
    expect(ctx.restrictions.avoidIngredients).toEqual([]);
    expect(ctx.restrictions.vegan).toBe(false);
  });

  it("drops blank entries rather than storing empty strings", () => {
    const ctx = buildUserFoodContext({ prefs: { avoidIngredients: ["  ", "salt", ""] } });
    expect(ctx.restrictions.avoidIngredients).toEqual(["salt"]);
  });
});
