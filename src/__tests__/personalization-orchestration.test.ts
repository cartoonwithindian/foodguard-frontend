import { describe, it, expect, vi } from "vitest";
import { decideAll, mergeOutcomes, pendingIds } from "@/lib/personalization/decision-orchestration";
import { buildUserFoodContext } from "@/lib/personalization/user-context";
import { defaultDailyTargets } from "@/lib/personalization/daily-targets";
import type { PersonalDecision } from "@/lib/personalization/decision-engine";
import type { ProductFoodProfile } from "@/lib/multi-scan/food-profile";

function profile(id: string): ProductFoodProfile {
  return {
    detectionId: `d-${id}`,
    productId: id,
    productName: id.toUpperCase(),
    brand: null,
    image: null,
    barcode: null,
    servingSize: "30g",
    nutrition: {
      basis: "PER_SERVING",
      calories: { value: 100, unit: "kcal" },
      carbohydrates: null,
      totalSugar: { value: 10, unit: "g" },
      addedSugar: null,
      protein: { value: 5, unit: "g" },
      fat: null,
      saturatedFat: null,
      fiber: null,
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

const ctx = buildUserFoodContext({
  prefs: { healthGoals: ["lower_sugar"] },
  today: { available: true, date: "2026-09-28", consumedFoods: [], consumedNutrition: { totalSugar: 10 } },
  dailyTargets: defaultDailyTargets(),
});

const fakeDecision = (id: string): PersonalDecision =>
  ({ productId: id, productName: id, fit: "HIGH" } as unknown as PersonalDecision);

describe("decision orchestration (pure, behind the hook)", () => {
  it("fans out to every profile concurrently", async () => {
    const decide = vi.fn(async (p: ProductFoodProfile) => fakeDecision(p.productId));
    const outcomes = await decideAll({ decide } as unknown as { decide: typeof decide }, [profile("a"), profile("b"), profile("c")], ctx);
    expect(decide).toHaveBeenCalledTimes(3);
    expect(outcomes.every((o) => o.ok)).toBe(true);
  });

  it("returns a per-product failure without dropping the siblings", async () => {
    const decide = vi.fn(async (p: ProductFoodProfile) => {
      if (p.productId === "b") throw new Error("boom");
      return fakeDecision(p.productId);
    });
    const outcomes = await decideAll({ decide } as unknown as { decide: typeof decide }, [profile("a"), profile("b"), profile("c")], ctx);
    expect(outcomes.filter((o) => o.ok).map((o) => o.productId)).toEqual(["a", "c"]);
    const failed = outcomes.find((o) => !o.ok)!;
    expect(failed).toMatchObject({ ok: false, productId: "b", error: "boom" });
  });

  it("merges into a map keyed by product id and surfaces the first error", () => {
    const { byProductId, error } = mergeOutcomes(new Map(), [
      { ok: true, productId: "a", decision: fakeDecision("a") },
      { ok: false, productId: "b", error: "nope" },
      { ok: true, productId: "c", decision: fakeDecision("c") },
    ]);
    expect([...byProductId.keys()]).toEqual(["a", "c"]);
    expect(error).toBe("nope");
  });

  it("preserves prior results for products outside the current batch", () => {
    const prev = new Map([["old", fakeDecision("old")]]);
    const { byProductId } = mergeOutcomes(prev, [
      { ok: true, productId: "new", decision: fakeDecision("new") },
    ]);
    expect(byProductId.has("old")).toBe(true);
    expect(byProductId.has("new")).toBe(true);
  });

  it("does not mutate the previous map", () => {
    const prev = new Map([["old", fakeDecision("old")]]);
    mergeOutcomes(prev, [{ ok: true, productId: "new", decision: fakeDecision("new") }]);
    expect(prev.size).toBe(1);
  });

  it("tracks pending ids for the whole batch", () => {
    expect([...pendingIds([profile("a"), profile("b")])]).toEqual(["a", "b"]);
    expect(pendingIds([]).size).toBe(0);
  });
});
