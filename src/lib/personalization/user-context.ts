/**
 * Phase 5 — User Food Context.
 *
 * FoodGuard's user profile ALREADY exists and is server-authoritative:
 *
 *   prisma/schema.prisma   model UserPreference
 *   lib/store/*            getUserPreferences() / upsertUserPreferences()
 *   types/domain.ts        UserPreferencesInput
 *   services/personalization.service.ts  personalize()
 *
 * This module does NOT create a second profile system. It projects the
 * existing persisted preferences into the shape the decision layer needs,
 * and joins them with the day's intake. The existing `UserPreferencesInput`
 * field names are preserved verbatim so nothing has to be re-mapped.
 *
 * Nothing here is inferred. A goal only exists if the user selected it; a
 * restriction only exists if it is stored. Missing context is represented
 * as null / empty, never defaulted to a safe-looking value.
 */
import type { UserPreferencesInput } from "@/types/domain";

/** A nutrient key in the ProfileNutrition space (Phase 4). */
export type ContextNutrientKey =
  | "calories"
  | "carbohydrates"
  | "totalSugar"
  | "addedSugar"
  | "protein"
  | "fat"
  | "saturatedFat"
  | "fiber"
  | "sodium";

/** One thing the user actually ate today, with resolved nutrient amounts. */
export type ConsumedFood = {
  productId: string;
  productName: string;
  /** Epoch ms when it was recorded. */
  at: number;
  /** How many servings of the product were eaten (>= 1 in practice). */
  servings: number;
  /**
   * Per-serving amounts in the daily-target unit space. A null entry means
   * "not available" and is never treated as 0.
   */
  nutrients: Partial<Record<ContextNutrientKey, number | null>>;
};

/**
 * The day's resolved intake. `available` is false when the app genuinely has
 * no food log for today — callers must say so rather than showing zeros.
 */
export type TodayIntake = {
  available: boolean;
  /** Local calendar date, YYYY-MM-DD. */
  date: string | null;
  consumedFoods: ConsumedFood[];
  /** Summed per-day totals in target units. null key = not available. */
  consumedNutrition: Partial<Record<ContextNutrientKey, number | null>>;
};

/**
 * Personal daily limits. Values come from the app's own reference guidance
 * (WHO_DAILY) unless the user has explicitly set their own. `source` records
 * where each number came from so the UI can attribute it honestly.
 */
export type DailyTargets = {
  values: Partial<Record<ContextNutrientKey, { amount: number; unit: string; source: string }>>;
};

/** User-selected goals. Only what the user actually chose. */
export type UserGoals = {
  /** Raw stored healthGoals, e.g. ["weight_loss", "improve_nutrition"]. */
  healthGoals: string[];
  /** True when at least one goal was explicitly selected. */
  hasGoals: boolean;
};

/** Explicit restrictions. Never inferred from health data. */
export type UserRestrictions = {
  vegetarian: boolean;
  vegan: boolean;
  /** Declared allergies — user-supplied only, never inferred. */
  allergies: string[];
  dietaryRestrictions: string[];
  /** Ingredients the user explicitly asked to avoid. */
  avoidIngredients: string[];
};

export type UserPreferences = {
  /** Ingredients the user explicitly prefers. */
  preferredIngredients: string[];
  sensitivityPreferences: string[];
};

/**
 * The complete personalization input. This is the ONLY user object the
 * decision layer and JEV receive.
 */
export type UserFoodContext = {
  profile: {
    vegetarian: boolean;
    vegan: boolean;
    /** True when the app has a persisted profile for this user. */
    hasProfile: boolean;
  };
  goals: UserGoals;
  restrictions: UserRestrictions;
  preferences: UserPreferences;
  today: TodayIntake;
  dailyTargets: DailyTargets;
};

const asList = (value: string[] | undefined): string[] =>
  Array.isArray(value) ? value.filter((v) => typeof v === "string" && v.trim().length > 0) : [];

const EMPTY_TARGETS: DailyTargets = { values: {} };

/** Context for a user with no stored profile and no food log. */
export function emptyUserFoodContext(
  today: TodayIntake = {
    available: false,
    date: null,
    consumedFoods: [],
    consumedNutrition: {},
  },
): UserFoodContext {
  return {
    profile: { vegetarian: false, vegan: false, hasProfile: false },
    goals: { healthGoals: [], hasGoals: false },
    restrictions: { vegetarian: false, vegan: false, allergies: [], dietaryRestrictions: [], avoidIngredients: [] },
    preferences: { preferredIngredients: [], sensitivityPreferences: [] },
    today,
    dailyTargets: EMPTY_TARGETS,
  };
}

export type BuildUserFoodContextInput = {
  /** The app's existing persisted preferences, if any. */
  prefs?: UserPreferencesInput | null;
  today?: TodayIntake;
  dailyTargets?: DailyTargets;
};

/**
 * Project the existing persisted preferences into a UserFoodContext.
 *
 * Pure: no store access, no network, no inference. Pass the result of
 * `store.getUserPreferences(userId)` (already mapped to
 * UserPreferencesInput) and the day's intake.
 */
export function buildUserFoodContext(input: BuildUserFoodContextInput = {}): UserFoodContext {
  const prefs = input.prefs ?? null;
  const today =
    input.today ??
    ({
      available: false,
      date: null,
      consumedFoods: [],
      consumedNutrition: {},
    } satisfies TodayIntake);

  if (!prefs) return emptyUserFoodContext(today);

  const healthGoals = asList(prefs.healthGoals);
  const vegetarian = prefs.vegetarian === true;
  const vegan = prefs.vegan === true;

  return {
    profile: { vegetarian, vegan, hasProfile: true },
    goals: { healthGoals, hasGoals: healthGoals.length > 0 },
    restrictions: {
      vegetarian,
      vegan,
      allergies: asList(prefs.allergies),
      dietaryRestrictions: asList(prefs.dietaryRestrictions),
      avoidIngredients: asList(prefs.avoidIngredients),
    },
    preferences: {
      preferredIngredients: asList(prefs.preferredIngredients),
      sensitivityPreferences: asList(prefs.sensitivityPreferences),
    },
    today,
    dailyTargets: input.dailyTargets ?? EMPTY_TARGETS,
  };
}

/**
 * True when the user has given us anything personal to reason about. Used to
 * decide between "personalized fit" and an honest "no personal context".
 */
export function hasPersonalContext(ctx: UserFoodContext): boolean {
  return (
    ctx.profile.hasProfile &&
    (ctx.goals.hasGoals ||
      ctx.restrictions.vegetarian ||
      ctx.restrictions.vegan ||
      ctx.restrictions.allergies.length > 0 ||
      ctx.restrictions.dietaryRestrictions.length > 0 ||
      ctx.restrictions.avoidIngredients.length > 0 ||
      ctx.preferences.preferredIngredients.length > 0)
  );
}
