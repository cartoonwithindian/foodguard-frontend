import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  FoodProfileAnalyzer,
  resetProfileCacheForTesting,
} from "@/lib/multi-scan/profile-analyzer";
import type { UnderstandingResult } from "@/lib/multi-scan/food-understanding";
import type { ProfileLookupResult } from "@/lib/multi-scan/profile-lookup";
import type { NutritionFacts } from "@/types/domain";

const FACTS: NutritionFacts = {
  servingSize: "30g",
  basis: "PER_SERVING",
  nutrients: {
    calories: { value: 110, unit: "kcal", confidence: 0.8 },
    sugars: { value: 12, unit: "g", confidence: 0.8 },
    protein: { value: 4, unit: "g", confidence: 0.8 },
  },
};

const lookupOk = (overrides: Partial<Extract<ProfileLookupResult, { ok: true }>> = {}) =>
  ({
    ok: true as const,
    product: {
      name: "Corn Flakes",
      brand: "Kellogg's",
      imageUrl: "http://img/cf.jpg",
      barcode: "123",
      category: "food",
      ingredientsRaw: "Corn, sugar, malt flavor, salt",
      source: "network",
    },
    nutrition: FACTS,
    servingSize: "30g",
    source: "network",
    ...overrides,
  }) as Extract<ProfileLookupResult, { ok: true }>;

const understandOk = (): UnderstandingResult => ({
  ok: true,
  understanding: {
    ingredientInsights: [{ type: "added_sugar", label: "Contains added sugar", evidence: "sugar" }],
    nutritionInsights: [{ type: "sugars", label: "Sugar is 12g per serving", value: 12, unit: "g", evidence: "product nutrition data" }],
    flags: [],
    unavailable: ["fiber", "sodium"],
  },
  source: "mock",
});

const input = (detectionId: string, productId = `p-${detectionId}`) => ({
  detectionId,
  productId,
  productName: `Product ${detectionId}`,
});

describe("FoodProfileAnalyzer (mocked lookup + understanding)", () => {
  beforeEach(() => resetProfileCacheForTesting());

  it("builds a structured profile for a confirmed product", async () => {
    const lookup = vi.fn(async () => lookupOk());
    const understand = vi.fn(async () => understandOk());
    const analyzer = new FoodProfileAnalyzer({ lookup, understand });

    const [p] = await analyzer.analyze([input("d1")]);
    expect(p.status).toBe("ready");
    expect(p.productName).toBe("Corn Flakes");
    expect(p.brand).toBe("Kellogg's");
    expect(p.nutrition.basis).toBe("PER_SERVING");
    expect(p.nutrition.totalSugar).toEqual({ value: 12, unit: "g" });
    expect(p.nutrition.fiber).toBeNull();
    expect(p.servingSize).toBe("30g");
    expect(p.ingredients.rawText).toContain("Corn");
    expect(p.ingredients.normalized.length).toBeGreaterThan(0);
    expect(p.understanding?.ingredientInsights[0]?.evidence).toBe("sugar");
    expect(p.understandingSource).toBe("mock");
    expect(p.source).toBe("network");
  });

  it("marks missing nutrition as unavailable, never zero", async () => {
    const lookup = vi.fn(async () => lookupOk({ nutrition: null, servingSize: null }));
    // Ingredients exist → understanding still runs, nutrition stays null.
    const analyzer = new FoodProfileAnalyzer({ lookup, understand: vi.fn(async () => understandOk()) });
    const [p] = await analyzer.analyze([input("d1")]);
    expect(p.nutrition.totalSugar).toBeNull();
    expect(p.nutrition.basis).toBeNull();
    expect(p.servingSize).toBeNull();
    expect(p.status).toBe("ready");
  });

  it("marks data_unavailable when neither nutrition nor ingredients exist", async () => {
    const lookup = vi.fn(async () =>
      lookupOk({
        nutrition: null,
        servingSize: null,
        product: {
          name: "Mystery",
          brand: null,
          imageUrl: null,
          barcode: null,
          category: "food",
          ingredientsRaw: "",
          source: "network",
        },
      }),
    );
    const understand = vi.fn(async () => understandOk());
    const analyzer = new FoodProfileAnalyzer({ lookup, understand });
    const [p] = await analyzer.analyze([input("d1")]);
    expect(p.status).toBe("data_unavailable");
    expect(p.error).toMatch(/unavailable/i);
    expect(understand).not.toHaveBeenCalled();
  });

  it("keeps raw data when understanding fails", async () => {
    const lookup = vi.fn(async () => lookupOk());
    const understand = vi.fn(async (): Promise<UnderstandingResult> => ({
      ok: false,
      code: "QWEN_ERROR",
      message: "AI ingredient interpretation unavailable.",
    }));
    const analyzer = new FoodProfileAnalyzer({ lookup, understand });
    const [p] = await analyzer.analyze([input("d1")]);
    expect(p.status).toBe("understanding_failed");
    expect(p.nutrition.totalSugar).toEqual({ value: 12, unit: "g" });
    expect(p.ingredients.normalized.length).toBeGreaterThan(0);
  });

  it("handles missing product and lookup errors per product", async () => {
    const lookup = vi.fn(async (): Promise<ProfileLookupResult> => ({
      ok: false,
      code: "PRODUCT_NOT_FOUND",
      message: "Not found.",
    }));
    const analyzer = new FoodProfileAnalyzer({ lookup, understand: vi.fn(async () => understandOk()) });
    const [p] = await analyzer.analyze([input("d1")]);
    expect(p.status).toBe("error");
    expect(p.error).toMatch(/not found/i);
  });

  it("analyzes multiple products independently — one failure stops nothing", async () => {
    const lookup = vi.fn(async (inp: { confirmedProductName: string | null }): Promise<ProfileLookupResult> => {
      if (inp.confirmedProductName === "Product d2") {
        return { ok: false, code: "PRODUCT_NOT_FOUND", message: "Not found." };
      }
      return lookupOk();
    });
    const analyzer = new FoodProfileAnalyzer({ lookup, understand: vi.fn(async () => understandOk()) });
    const profiles = await analyzer.analyze([input("d1"), input("d2"), input("d3")]);
    expect(profiles.map((p) => p.status)).toEqual(["ready", "error", "ready"]);
    expect(profiles.map((p) => p.detectionId)).toEqual(["d1", "d2", "d3"]);
  });

  it("streams progress per product", async () => {
    const analyzer = new FoodProfileAnalyzer({
      lookup: vi.fn(async () => lookupOk()),
      understand: vi.fn(async () => understandOk()),
    });
    const seen: Array<{ completed: number; total: number }> = [];
    await analyzer.analyze([input("d1"), input("d2")], (p) =>
      seen.push({ completed: p.completed, total: p.total }),
    );
    expect(seen).toEqual([
      { completed: 1, total: 2 },
      { completed: 2, total: 2 },
    ]);
  });

  it("caches by productId across scans", async () => {
    const lookup = vi.fn(async () => lookupOk());
    const understand = vi.fn(async () => understandOk());
    const analyzer = new FoodProfileAnalyzer({ lookup, understand });
    await analyzer.analyze([input("d1", "same-id")]);
    await analyzer.analyze([input("d9", "same-id")]);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(understand).toHaveBeenCalledTimes(1);
  });

  it("serializes to JSON for Phase 5 handoff", async () => {
    const analyzer = new FoodProfileAnalyzer({
      lookup: vi.fn(async () => lookupOk()),
      understand: vi.fn(async () => understandOk()),
    });
    const [p] = await analyzer.analyze([input("d1")]);
    const roundTrip = JSON.parse(JSON.stringify(p)) as typeof p;
    expect(roundTrip.productName).toBe(p.productName);
    expect(roundTrip.nutrition.totalSugar).toEqual({ value: 12, unit: "g" });
    expect(roundTrip.status).toBe("ready");
  });
});
