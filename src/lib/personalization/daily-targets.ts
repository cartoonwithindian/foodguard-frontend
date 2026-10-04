/**
 * Phase 5 — daily target resolution.
 *
 * Targets are NOT invented here. FoodGuard already ships centralized daily
 * reference guidance in `lib/health-analysis/reference-values.ts`
 * (`WHO_DAILY`, "Daily upper limit" / "Minimum daily intake"), and that
 * file's own header says: "Do NOT scatter hard-coded numbers throughout
 * prompts or analysis logic." So Phase 5 reads from it instead of adding a
 * second table of numbers.
 *
 * The mapping below is only a unit/key translation between the WHO key
 * space and the Phase 4 `ProfileNutrition` key space. No value is changed.
 *
 * User-set targets, when the app has them, take precedence — the `source`
 * field records which layer supplied each number so the UI can attribute it.
 */
import { WHO_DAILY } from "@/lib/health-analysis/reference-values";
import type { ContextNutrientKey, DailyTargets } from "./user-context";

/**
 * WHO reference key → ProfileNutrition key, with the daily-target unit.
 * `energy` → calories, `fibre` → fiber, etc.
 */
const WHO_KEY_MAP: Array<{ who: string; key: ContextNutrientKey; unit: string }> = [
  { who: "sugars", key: "totalSugar", unit: "g" },
  { who: "addedSugars", key: "addedSugar", unit: "g" },
  { who: "energy", key: "calories", unit: "kcal" },
  { who: "protein", key: "protein", unit: "g" },
  { who: "fibre", key: "fiber", unit: "g" },
  { who: "sodium", key: "sodium", unit: "mg" },
  { who: "saturatedFat", key: "saturatedFat", unit: "g" },
  { who: "totalFat", key: "fat", unit: "g" },
];

/** Nutrients that have a meaningful daily limit in the app's guidance. */
export const TARGETABLE_NUTRIENTS: ContextNutrientKey[] = WHO_KEY_MAP.map((m) => m.key);

/**
 * Daily targets derived from the app's own WHO reference guidance.
 * Each entry keeps its authority and context string for honest attribution.
 */
export function defaultDailyTargets(): DailyTargets {
  const values: DailyTargets["values"] = {};
  for (const { who, key, unit } of WHO_KEY_MAP) {
    const ref = WHO_DAILY[who];
    if (!ref || !Number.isFinite(ref.value) || ref.value <= 0) continue;
    values[key] = {
      amount: ref.value,
      unit: ref.unit === unit ? unit : ref.unit,
      source: `${ref.authority} daily reference (${ref.context.toLowerCase()})`,
    };
  }
  return { values };
}

/**
 * Merge user-set targets over the defaults. User values win per key; a
 * non-finite or non-positive user value is ignored rather than trusted.
 */
export function resolveDailyTargets(userTargets?: DailyTargets | null): DailyTargets {
  const base = defaultDailyTargets();
  if (!userTargets?.values) return base;
  const values = { ...base.values };
  for (const [key, entry] of Object.entries(userTargets.values)) {
    if (!entry) continue;
    if (typeof entry.amount !== "number" || !Number.isFinite(entry.amount) || entry.amount <= 0) {
      continue;
    }
    values[key as ContextNutrientKey] = { ...entry };
  }
  return { values };
}
