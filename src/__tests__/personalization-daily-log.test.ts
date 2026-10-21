import { describe, it, expect, beforeEach, vi } from "vitest";

// localStorage is not present in the node test environment.
class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}

const storage = new MemoryStorage();
vi.stubGlobal("window", { localStorage: storage });
vi.stubGlobal("localStorage", storage);

const {
  DAILY_LOG_STORAGE_KEY,
  clearDailyLog,
  contextSignature,
  localDateKey,
  logConsumption,
  readToday,
  removeConsumption,
} = await import("@/lib/personalization/daily-log");

const NOW = new Date(2026, 8, 28, 13, 30); // 2026-09-28 local

describe("daily intake log", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("reports no food log for a fresh day rather than pretending zero", () => {
    const t = readToday(NOW);
    expect(t.available).toBe(false);
    expect(t.consumedFoods).toEqual([]);
    expect(t.date).toBe("2026-09-28");
  });

  it("accumulates intake across foods", () => {
    logConsumption({
      productId: "a",
      productName: "Tea",
      nutrients: { totalSugar: 10, protein: 1 },
      now: NOW,
    });
    logConsumption({
      productId: "b",
      productName: "Toast",
      nutrients: { totalSugar: 5, protein: 4 },
      now: NOW,
    });
    const t = readToday(NOW);
    expect(t.available).toBe(true);
    expect(t.consumedFoods).toHaveLength(2);
    expect(t.consumedNutrition.totalSugar).toBe(15);
    expect(t.consumedNutrition.protein).toBe(5);
  });

  it("is idempotent per (productId, timestamp) so a double tap cannot double-count", () => {
    const at = NOW.getTime();
    logConsumption({ productId: "a", productName: "Tea", nutrients: { totalSugar: 10 }, at, now: NOW });
    logConsumption({ productId: "a", productName: "Tea", nutrients: { totalSugar: 10 }, at, now: NOW });
    expect(readToday(NOW).consumedNutrition.totalSugar).toBe(10);
  });

  it("multiplies by servings", () => {
    logConsumption({
      productId: "a",
      productName: "Yogurt",
      nutrients: { protein: 5 },
      servings: 3,
      now: NOW,
    });
    expect(readToday(NOW).consumedNutrition.protein).toBe(15);
  });

  it("keeps unreported nutrients absent rather than zeroing them", () => {
    logConsumption({ productId: "a", productName: "Tea", nutrients: { protein: 2 }, now: NOW });
    const t = readToday(NOW);
    expect(t.consumedNutrition.protein).toBe(2);
    expect(t.consumedNutrition.sodium).toBeUndefined();
  });

  it("does not carry yesterday's log into today", () => {
    const yesterday = new Date(2026, 8, 27, 20, 0);
    logConsumption({ productId: "a", productName: "Dinner", nutrients: { totalSugar: 30 }, now: yesterday });
    const t = readToday(NOW);
    expect(t.available).toBe(false);
    expect(t.consumedNutrition.totalSugar).toBeUndefined();
  });

  it("removes an entry and recomputes totals", () => {
    logConsumption({ productId: "a", productName: "Tea", nutrients: { totalSugar: 10 }, now: NOW });
    logConsumption({ productId: "b", productName: "Toast", nutrients: { totalSugar: 5 }, now: NOW });
    const t = removeConsumption("a", NOW);
    expect(t.consumedFoods).toHaveLength(1);
    expect(t.consumedNutrition.totalSugar).toBe(5);
  });

  it("clears the day", () => {
    logConsumption({ productId: "a", productName: "Tea", nutrients: { totalSugar: 10 }, now: NOW });
    expect(clearDailyLog(NOW).available).toBe(false);
  });

  it("recovers from corrupt stored data instead of throwing", () => {
    storage.setItem(DAILY_LOG_STORAGE_KEY, "{not json");
    expect(readToday(NOW).available).toBe(false);
  });

  it("ignores a stored log from an older schema version", () => {
    storage.setItem(DAILY_LOG_STORAGE_KEY, JSON.stringify({ version: 0, days: { "2026-09-28": { date: "2026-09-28", totals: { totalSugar: 99 }, foods: [] } } }));
    expect(readToday(NOW).available).toBe(false);
  });

  it("ignores non-finite and non-numeric nutrient values", () => {
    logConsumption({
      productId: "a",
      productName: "X",
      nutrients: { totalSugar: NaN, protein: "5" as unknown as number },
      now: NOW,
    });
    const t = readToday(NOW);
    expect(t.consumedNutrition.totalSugar).toBeUndefined();
  });

  it("uses a local calendar date, not UTC", () => {
    expect(localDateKey(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
    expect(localDateKey(new Date(2026, 11, 31, 23, 30))).toBe("2026-12-31");
  });
});

describe("context signature (decision cache key)", () => {
  const base = {
    today: { available: true, date: "2026-09-28", consumedFoods: [], consumedNutrition: { totalSugar: 20 } },
    goals: { healthGoals: ["lower_sugar"] },
    restrictions: { vegetarian: false, vegan: false, allergies: [], dietaryRestrictions: [], avoidIngredients: [] },
  };

  it("is stable for identical context", () => {
    expect(contextSignature(base)).toBe(contextSignature({ ...base }));
  });

  it("changes when the day's intake changes", () => {
    expect(contextSignature(base)).not.toBe(
      contextSignature({
        ...base,
        today: { ...base.today, consumedNutrition: { totalSugar: 25 } },
      }),
    );
  });

  it("changes when the date rolls over", () => {
    expect(contextSignature(base)).not.toBe(
      contextSignature({ ...base, today: { ...base.today, date: "2026-09-29" } }),
    );
  });

  it("changes when a goal or restriction changes", () => {
    expect(contextSignature(base)).not.toBe(
      contextSignature({ ...base, goals: { healthGoals: ["higher_protein"] } }),
    );
    expect(contextSignature(base)).not.toBe(
      contextSignature({ ...base, restrictions: { ...base.restrictions, vegan: true } }),
    );
  });
});
