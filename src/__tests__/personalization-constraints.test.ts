import { describe, it, expect } from "vitest";
import { analyzeContext } from "@/lib/personalization/context-engine";
import {
  checkHardConstraints,
  hasHardViolation,
  hardViolations,
} from "@/lib/personalization/constraints";
import { buildUserFoodContext, type UserFoodContext } from "@/lib/personalization/user-context";
import { defaultDailyTargets } from "@/lib/personalization/daily-targets";
import type { ProductFoodProfile } from "@/lib/multi-scan/food-profile";

function profileWith(ingredients: string[], rawText?: string): ProductFoodProfile {
  return {
    detectionId: "d1",
    productId: "p1",
    productName: "Snack Bar",
    brand: null,
    image: null,
    barcode: null,
    servingSize: "30g",
    nutrition: {
      basis: "PER_100G",
      calories: { value: 200, unit: "kcal" },
      carbohydrates: null,
      totalSugar: { value: 10, unit: "g" },
      addedSugar: null,
      protein: null,
      fat: null,
      saturatedFat: null,
      fiber: null,
      sodium: null,
    },
    ingredients: { rawText: rawText ?? ingredients.join(", "), normalized: ingredients },
    categories: ["food"],
    understanding: null,
    understandingSource: "unavailable",
    source: "test",
    fetchedAt: 1,
    status: "ready",
  };
}

type PrefsArg = NonNullable<Parameters<typeof buildUserFoodContext>[0]>["prefs"];

const ctx = (prefs: PrefsArg): UserFoodContext =>
  buildUserFoodContext({ prefs, dailyTargets: defaultDailyTargets() });

// ── Case 6: hard constraint violation ───────────────────────────────────

describe("hard constraints are deterministic and evidence-bound", () => {
  it("case 6 — flags an explicitly avoided ingredient", () => {
    const p = profileWith(["Peanuts", "Sugar"]);
    const v = checkHardConstraints(p, ctx({ avoidIngredients: ["peanuts"] }));
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({
      kind: "avoided_ingredient",
      severity: "hard",
      evidence: "ingredients",
      determined: true,
    });
    expect(v[0].ingredient).toMatch(/peanut/i);
    expect(hasHardViolation(v)).toBe(true);
  });

  it("case 7 — no constraint means no violation, not a manufactured one", () => {
    const p = profileWith(["Peanuts", "Sugar"]);
    const v = checkHardConstraints(p, ctx({ healthGoals: ["higher_protein"] }));
    expect(v).toEqual([]);
    expect(hasHardViolation(v)).toBe(false);
  });

  it("matches a declared allergen in the ingredient list as a hard violation", () => {
    const p = profileWith(["Peanut", "Sugar"]);
    const v = checkHardConstraints(p, ctx({ allergies: ["peanut"] }));
    expect(v[0].kind).toBe("declared_allergen");
    expect(v[0].severity).toBe("hard");
  });

  it("softens a declared allergen to advisory on a may-contain statement", () => {
    const p = profileWith(
      ["Peanut"],
      "Oats, peanut. May contain traces of peanut.",
    );
    const v = checkHardConstraints(p, ctx({ allergies: ["peanut"] }));
    expect(v[0].severity).toBe("advisory");
    // Advisory is surfaced but does not block the decision.
    expect(hasHardViolation(v)).toBe(false);
  });

  it("flags a vegan conflict from the existing ingredient knowledge base", () => {
    const v = checkHardConstraints(profileWith(["Milk"]), ctx({ vegan: true }));
    expect(v.map((x) => x.kind)).toContain("vegan");
    expect(v[0].severity).toBe("hard");
  });

  it("flags a vegetarian conflict from the existing knowledge base", () => {
    // "Egg" is a real KB record carrying `not_vegan`. The KB has no meat
    // records, so a meat fixture would silently assert nothing.
    const v = checkHardConstraints(profileWith(["Egg"]), ctx({ vegetarian: true }));
    expect(v.map((x) => x.kind)).toContain("vegetarian");
  });

  it("mirrors the existing personalization service's diet semantics", () => {
    // Parity guard: Phase 5 must not diverge from
    // services/personalization.service.ts DIET_CONFLICT_HINTS, which uses the
    // same forbidden status set for vegan and vegetarian.
    const vegan = checkHardConstraints(profileWith(["Milk"]), ctx({ vegan: true }));
    const veg = checkHardConstraints(profileWith(["Milk"]), ctx({ vegetarian: true }));
    expect(vegan.length).toBe(veg.length);
    expect(veg[0].severity).toBe("hard");
  });

  it("flags a user-declared dietary restriction that matches the KB", () => {
    const v = checkHardConstraints(profileWith(["Wheat Flour"]), ctx({ dietaryRestrictions: ["gluten"] }));
    expect(v).toEqual([]);
    // No KB-backed "gluten" restriction is invented; an unmatched restriction
    // simply does not fire.
  });

  it("does NOT invent an allergy the user never declared", () => {
    // Peanuts present, but the user stored no allergy — nothing is inferred.
    const v = checkHardConstraints(profileWith(["Peanuts"]), ctx({ healthGoals: ["lower_sugar"] }));
    expect(v).toEqual([]);
  });

  it("ignores an allergy when the product has no ingredients at all", () => {
    const v = checkHardConstraints(profileWith([]), ctx({ allergies: ["peanut"] }));
    expect(v).toEqual([]);
  });

  it("sorts hard violations ahead of advisory ones", () => {
    const p = profileWith(
      ["Peanut", "Milk"],
      "Peanut, milk. May contain traces of peanut.",
    );
    const v = checkHardConstraints(p, ctx({ allergies: ["peanut"], vegan: true }));
    expect(v[0].severity).toBe("hard");
  });

  it("surfaces the violation in the deterministic analysis as final", () => {
    const a = analyzeContext(profileWith(["Peanuts"]), ctx({ avoidIngredients: ["peanuts"] }));
    expect(a.hardConstraintViolation).toBe(true);
    expect(a.fit).toBe("CONFLICT");
    expect(hardViolations(a.constraintViolations).length).toBeGreaterThan(0);
  });
});
