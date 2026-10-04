/**
 * Phase 5 — Daily intake log (the app's only food-history store).
 *
 * Step 1 of Phase 5 found that FoodGuard has NO daily intake tracking at
 * all: `consumedNutrition`, `dailyIntake`, `mealLog` etc. do not exist
 * anywhere in the repo. `HistoryEntryInfo` stores an *assessment snapshot*,
 * which is explicitly not consumption. So this module is the first, and
 * deliberately the only, consumption record — not a duplicate of anything.
 *
 * Storage decision: device-local (localStorage), NOT a server table.
 *  - Daily intake is inherently per-device, per-day, and short-lived.
 *  - The scanner is a client component; the server `DataStore` has no
 *    consumption concept and adding one would mean coordinated changes to
 *    the Prisma schema plus all three store implementations for no
 *    cross-device benefit at this stage.
 *  - Nothing here is a substitute for the server-authoritative
 *    `UserPreference` profile, which Phase 5 still reads as the source of
 *    truth for goals and restrictions.
 *
 * Honesty rules encoded here:
 *  - Entries are keyed by local calendar date, so yesterday's log never
 *    masquerades as today's.
 *  - A missing day is `available: false`, never an implicit zero.
 *  - Only nutrients the product actually reported are recorded; unknown
 *    nutrients stay null so downstream math can refuse to add them up.
 */
import type {
  ConsumedFood,
  ContextNutrientKey,
  TodayIntake,
} from "./user-context";

export const DAILY_LOG_STORAGE_KEY = "foodguard-daily-intake";
export const DAILY_LOG_VERSION = 1;

type StoredDay = {
  date: string;
  /** Totals in daily-target units, accumulated across entries. */
  totals: Partial<Record<ContextNutrientKey, number | null>>;
  foods: ConsumedFood[];
};

type DailyLogShape = {
  version: number;
  days: Record<string, StoredDay>;
};

/** Local calendar date as YYYY-MM-DD (device-local, not UTC). */
export function localDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isNutrientKey(k: string): k is ContextNutrientKey {
  return (
    k === "calories" ||
    k === "carbohydrates" ||
    k === "totalSugar" ||
    k === "addedSugar" ||
    k === "protein" ||
    k === "fat" ||
    k === "saturatedFat" ||
    k === "fiber" ||
    k === "sodium"
  );
}

function emptyDay(date: string): StoredDay {
  return { date, totals: {}, foods: [] };
}

/** Sum consumed amounts, keeping null for "never reported". */
function addInto(
  totals: Partial<Record<ContextNutrientKey, number | null>>,
  nutrients: Partial<Record<ContextNutrientKey, number | null>>,
  servings: number,
): void {
  for (const key of Object.keys(nutrients) as ContextNutrientKey[]) {
    const value = nutrients[key];
    if (value === null || value === undefined) continue;
    if (!Number.isFinite(value)) continue;
    const base = totals[key];
    totals[key] = (typeof base === "number" ? base : 0) + value * servings;
  }
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readLog(storage: StorageLike | null): DailyLogShape {
  if (!storage) return { version: DAILY_LOG_VERSION, days: {} };
  try {
    const raw = storage.getItem(DAILY_LOG_STORAGE_KEY);
    if (!raw) return { version: DAILY_LOG_VERSION, days: {} };
    const parsed = JSON.parse(raw) as Partial<DailyLogShape>;
    if (!parsed || parsed.version !== DAILY_LOG_VERSION || typeof parsed.days !== "object") {
      return { version: DAILY_LOG_VERSION, days: {} };
    }
    const days: Record<string, StoredDay> = {};
    for (const [date, day] of Object.entries(parsed.days)) {
      if (!day || typeof day.date !== "string") continue;
      days[date] = {
        date: day.date,
        totals: day.totals ?? {},
        foods: Array.isArray(day.foods) ? day.foods : [],
      };
    }
    return { version: DAILY_LOG_VERSION, days };
  } catch {
    return { version: DAILY_LOG_VERSION, days: {} };
  }
}

function writeLog(storage: StorageLike | null, log: DailyLogShape): void {
  if (!storage) return;
  try {
    storage.setItem(DAILY_LOG_STORAGE_KEY, JSON.stringify(log));
  } catch {
    // Quota or private-mode failure is non-fatal: personalization degrades.
  }
}

/** Today's intake, or an honest "unavailable" when nothing is logged. */
export function readToday(now: Date = new Date()): TodayIntake {
  const date = localDateKey(now);
  const log = readLog(getStorage());
  const day = log.days[date];
  if (!day || day.foods.length === 0) {
    return { available: false, date, consumedFoods: [], consumedNutrition: {} };
  }
  return {
    available: true,
    date,
    consumedFoods: [...day.foods],
    consumedNutrition: { ...day.totals },
  };
}

export type LogConsumptionInput = {
  productId: string;
  productName: string;
  /** Per-serving amounts in daily-target units; null = not available. */
  nutrients: Partial<Record<ContextNutrientKey, number | null>>;
  servings?: number;
  at?: number;
  now?: Date;
};

/**
 * Record that the user ate this product. Idempotent per (productId, at) so a
 * double click cannot double-count.
 */
export function logConsumption(input: LogConsumptionInput): TodayIntake {
  const now = input.now ?? new Date();
  const date = localDateKey(now);
  const servings = input.servings && input.servings > 0 ? input.servings : 1;
  const at = input.at ?? now.getTime();
  const storage = getStorage();
  const log = readLog(storage);
  const day = log.days[date] ?? emptyDay(date);

  if (!day.foods.some((f) => f.productId === input.productId && f.at === at)) {
    const nutrients: Partial<Record<ContextNutrientKey, number | null>> = {};
    for (const [k, v] of Object.entries(input.nutrients)) {
      if (!isNutrientKey(k)) continue;
      nutrients[k] = typeof v === "number" && Number.isFinite(v) ? v : null;
    }
    day.foods.push({
      productId: input.productId,
      productName: input.productName,
      at,
      servings,
      nutrients,
    });
    addInto(day.totals, nutrients, servings);
  }

  log.days[date] = day;
  // Keep the log bounded — only the last 14 days are ever useful.
  const dates = Object.keys(log.days).sort().reverse();
  for (const stale of dates.slice(14)) delete log.days[stale];
  writeLog(storage, log);

  return { available: true, date, consumedFoods: [...day.foods], consumedNutrition: { ...day.totals } };
}

/** Remove today's entry for a product (undo / re-scan corrections). */
export function removeConsumption(
  productId: string,
  now: Date = new Date(),
): TodayIntake {
  const date = localDateKey(now);
  const storage = getStorage();
  const log = readLog(storage);
  const day = log.days[date];
  if (!day) return { available: false, date, consumedFoods: [], consumedNutrition: {} };

  day.foods = day.foods.filter((f) => f.productId !== productId);
  const totals: Partial<Record<ContextNutrientKey, number | null>> = {};
  for (const food of day.foods) addInto(totals, food.nutrients, food.servings);
  if (day.foods.length === 0) delete log.days[date];
  else log.days[date] = { ...day, totals };
  writeLog(storage, log);

  return readToday(now);
}

export function clearDailyLog(now: Date = new Date()): TodayIntake {
  const date = localDateKey(now);
  const storage = getStorage();
  const log = readLog(storage);
  delete log.days[date];
  writeLog(storage, log);
  return { available: false, date, consumedFoods: [], consumedNutrition: {} };
}

/**
 * A short signature of the parts of context that change a decision.
 * Phase 5 uses it as part of the decision cache key so that eating another
 * food invalidates yesterday's reasoning (Step 19).
 */
export function contextSignature(ctx: {
  today: TodayIntake;
  goals: { healthGoals: string[] };
  restrictions: {
    vegetarian: boolean;
    vegan: boolean;
    allergies: string[];
    dietaryRestrictions: string[];
    avoidIngredients: string[];
  };
}): string {
  const parts = [
    ctx.today.date ?? "none",
    ctx.today.available ? "1" : "0",
    ...ctx.goals.healthGoals.slice().sort(),
    ctx.restrictions.vegetarian ? "veg" : "",
    ctx.restrictions.vegan ? "vegan" : "",
    ...ctx.restrictions.allergies.slice().sort(),
    ...ctx.restrictions.dietaryRestrictions.slice().sort(),
    ...ctx.restrictions.avoidIngredients.slice().sort(),
    ...Object.keys(ctx.today.consumedNutrition)
      .filter((k) => isNutrientKey(k))
      .sort()
      .map((k) => `${k}:${ctx.today.consumedNutrition[k as ContextNutrientKey] ?? "null"}`),
  ];
  return parts.filter(Boolean).join("|");
}
