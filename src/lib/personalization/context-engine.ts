/**
 * Phase 5 — deterministic context engine.
 *
 * THIS FILE OWNS ALL ARITHMETIC. The AI interpretation layer is given the
 * numbers this file produces and may only phrase them. It never computes a
 * percentage, never sums a nutrient, and never decides whether a target was
 * exceeded.
 *
 * Pure and synchronous: same profile + same context always yields the same
 * analysis, which is what makes it testable and auditable.
 *
 * Honest-degradation contract, enforced here rather than in the UI:
 *  - A nutrient the product never reported yields `status: "unavailable"`,
 *    never a 0 and never a silent skip.
 *  - A PER_100G profile with no parseable serving weight yields
 *    `status: "basis_unavailable"` rather than an assumed serving size.
 *  - A day with no food log yields `todayAvailable: false`; remaining
 *    targets are reported as unknown, not as "full budget".
 *  - A target already exceeded yields a negative remaining value, because
 *    hiding that would be the least honest option.
 */
import type { NutrientAmount, ProductFoodProfile } from "@/lib/multi-scan/food-profile";
import { normalizeNutritionValue } from "@/lib/nutrition/units";
import { ingredientIndex } from "@/lib/ingredients";
import type { ContextNutrientKey, UserFoodContext } from "./user-context";
import { TARGETABLE_NUTRIENTS } from "./daily-targets";
import {
  checkHardConstraints,
  hardViolations,
  type HardConstraintViolation,
} from "./constraints";

export type ContextNutrientLabel = {
  key: ContextNutrientKey;
  label: string;
  unit: string;
};

const NUTRIENT_LABELS: Record<ContextNutrientKey, string> = {
  calories: "Calories",
  carbohydrates: "Carbohydrates",
  totalSugar: "Sugar",
  addedSugar: "Added sugar",
  protein: "Protein",
  fat: "Fat",
  saturatedFat: "Saturated fat",
  fiber: "Fiber",
  sodium: "Sodium",
};

/** Per-key arithmetic result for one product in one context. */
export type NutrientImpact = {
  key: ContextNutrientKey;
  label: string;
  unit: string;
  /** What this serving of the product contributes. null if not computable. */
  productAmount: number | null;
  /** Already consumed today. null when the day's log is unavailable. */
  consumedBefore: number | null;
  /** The daily target, null when the app has no target for this key. */
  target: number | null;
  /** target - consumedBefore. Null when either is unknown. */
  remainingBefore: number | null;
  /** remainingBefore - productAmount. Null when not computable. */
  remainingAfter: number | null;
  /**
   * productAmount / remainingBefore as a fraction of the *remaining*
   * budget. Null when the budget is unknown or already at/below zero.
   */
  shareOfRemaining: number | null;
  /** Which side of the daily target this product lands on. */
  direction: "toward_limit" | "toward_minimum" | "neutral" | "unknown";
  /** Whether this serving crosses the daily target. */
  exceedsTarget: boolean | null;
  /** Why a number is missing, when it is. */
  unavailableReason:
    | "product_nutrition_missing"
    | "basis_unavailable"
    | "today_unavailable"
    | "no_target"
    | null;
  /** Unit the product reported, before conversion to the target unit. */
  productSourceUnit: string | null;
};

export type PersonalFit = "HIGH" | "MEDIUM" | "LOW" | "CONFLICT" | "UNKNOWN";

export type GoalAlignment = {
  goal: string;
  /** Only goals the user actually selected are ever present here. */
  supports: boolean | null;
  reason: string;
  evidence: string[];
};

export type ContextEvidence = {
  /** "product" = objective product fact, "context" = user's stored day. */
  kind: "product_fact" | "personal_context" | "calculation";
  label: string;
  detail: string;
};

export type ContextAnalysis = {
  productId: string;
  productName: string;
  /** False when the user gave us no personal data to reason about. */
  hasPersonalContext: boolean;
  /** False when the app has no food log for today. */
  todayAvailable: boolean;
  /** Serving weight in grams, when derivable. */
  servingGrams: number | null;
  impacts: NutrientImpact[];
  constraintViolations: HardConstraintViolation[];
  /** True when at least one determined hard restriction is violated. */
  hardConstraintViolation: boolean;
  goalAlignment: GoalAlignment[];
  fit: PersonalFit;
  /** Why `fit` is what it is — deterministic reasons, not prose. */
  fitReasons: string[];
  evidence: ContextEvidence[];
  /** Things that make this analysis less trustworthy. */
  uncertainties: string[];
  /** The daily targets actually applied, for display. */
  targets: UserFoodContext["dailyTargets"];
};

/**
 * Parse a serving weight in grams out of a serving-size string.
 * Accepts "30g", "30 g", "1 cup (30g)", "30 grams". Returns null otherwise —
 * we never estimate a serving from a product name.
 */
export function parseServingGrams(servingSize: string | null | undefined): number | null {
  if (!servingSize) return null;
  const m = /(\d+(?:[.,]\d+)?)\s*(g\b|gram|grams|gm)/i.exec(servingSize);
  if (!m) return null;
  const value = Number.parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(value) || value <= 0 || value > 5000) return null;
  return value;
}

/**
 * Convert a reported nutrient amount to a per-serving amount in the daily
 * target's unit.
 *
 * - PER_SERVING: the value already is a serving; convert units only.
 * - PER_100G: needs a serving weight to scale. Without one we refuse.
 *
 * Returns null (with a reason) rather than assuming 100g = 1 serving.
 */
function perServingAmount(
  amount: NutrientAmount,
  basis: ProductFoodProfile["nutrition"]["basis"],
  servingGrams: number | null,
  targetUnit: string,
): { value: number; reason: NutrientImpact["unavailableReason"] } | { value: null; reason: NutrientImpact["unavailableReason"] } {
  if (!amount) return { value: null, reason: "product_nutrition_missing" };
  if (!basis) return { value: null, reason: "basis_unavailable" };

  try {
    if (basis === "PER_SERVING") {
      return {
        value: normalizeNutritionValue(amount.value, amount.unit, targetUnit).normalizedValue,
        reason: null,
      };
    }
    // PER_100G — scale by the real serving weight.
    if (servingGrams === null) return { value: null, reason: "basis_unavailable" };
    const scaled = (amount.value * servingGrams) / 100;
    return {
      value: normalizeNutritionValue(scaled, amount.unit, targetUnit).normalizedValue,
      reason: null,
    };
  } catch {
    // Unsupported unit conversion — better to omit than to guess.
    return { value: null, reason: "product_nutrition_missing" };
  }
}

const isNutrientMinimized = (key: ContextNutrientKey): boolean =>
  key === "protein" || key === "fiber";

function round(n: number, places = 1): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/**
 * Build the full deterministic analysis for one product in one context.
 * This is the authoritative layer: its `hardConstraintViolation` and its
 * `impacts` numbers are what the UI shows, whatever the AI returns.
 */
export function analyzeContext(
  profile: ProductFoodProfile,
  ctx: UserFoodContext,
): ContextAnalysis {
  const todayAvailable = ctx.today.available;
  const targetValues = ctx.dailyTargets.values;
  const servingGrams = parseServingGrams(profile.servingSize);
  const uncertainties: string[] = [];
  const evidence: ContextEvidence[] = [];
  const impacts: NutrientImpact[] = [];

  for (const key of TARGETABLE_NUTRIENTS) {
    const targetEntry = targetValues[key];
    const target = targetEntry ? targetEntry.amount : null;
    const unit = targetEntry?.unit ?? defaultUnit(key);
    const amount = profile.nutrition[key] ?? null;

    const perServing = perServingAmount(amount, profile.nutrition.basis, servingGrams, unit);
    const productAmount = perServing.value;

    const consumedRaw = ctx.today.consumedNutrition[key];
    // Two different meanings, deliberately not conflated:
    //  - the day is available and nothing was logged at all → a true 0
    //  - food WAS logged but no entry reported this nutrient → unknown,
    //    because summing "never reported" as 0 would understate intake
    let consumedBefore: number | null = null;
    if (todayAvailable) {
      if (ctx.today.consumedFoods.length === 0) consumedBefore = 0;
      else if (typeof consumedRaw === "number" && Number.isFinite(consumedRaw)) consumedBefore = consumedRaw;
    }
    const target_ = target;
    const remainingBefore =
      target_ !== null && consumedBefore !== null ? round(target_ - consumedBefore) : null;
    const remainingAfter =
      remainingBefore !== null && productAmount !== null ? round(remainingBefore - productAmount) : null;

    // Share of the *remaining* budget. Meaningless once the budget is gone.
    const shareOfRemaining =
      productAmount !== null && remainingBefore !== null && remainingBefore > 0
        ? Math.min(productAmount / remainingBefore, 1)
        : null;

    let unavailableReason: NutrientImpact["unavailableReason"] = null;
    if (perServing.reason) unavailableReason = perServing.reason;
    else if (!todayAvailable) unavailableReason = "today_unavailable";
    else if (target_ === null) unavailableReason = "no_target";

    const exceedsTarget =
      target_ !== null && productAmount !== null
        ? isNutrientMinimized(key)
          ? productAmount + (consumedBefore ?? 0) > target_
          : (consumedBefore ?? 0) + productAmount > target_
        : null;

    const direction: NutrientImpact["direction"] =
      target_ === null
        ? "unknown"
        : isNutrientMinimized(key)
          ? productAmount !== null
            ? "toward_minimum"
            : "unknown"
          : "toward_limit";

    impacts.push({
      key,
      label: NUTRIENT_LABELS[key],
      unit,
      productAmount: productAmount === null ? null : round(productAmount),
      consumedBefore: consumedBefore === null ? null : round(consumedBefore),
      target: target_,
      remainingBefore,
      remainingAfter,
      shareOfRemaining: shareOfRemaining === null ? null : round(shareOfRemaining, 3),
      direction,
      exceedsTarget,
      unavailableReason,
      productSourceUnit: amount?.unit ?? null,
    });
  }

  // ── Evidence trail (Step 16: fact vs context vs calculation) ─────────
  if (profile.nutrition.basis) {
    evidence.push({
      kind: "product_fact",
      label: "Product basis",
      detail:
        profile.nutrition.basis === "PER_100G"
          ? `Values reported per 100g${servingGrams ? `; serving size ${servingGrams}g` : ""}.`
          : "Values reported per serving.",
    });
  } else {
    uncertainties.push("Product nutrition basis is unknown, so per-serving amounts cannot be derived.");
  }
  if (servingGrams === null && profile.nutrition.basis === "PER_100G") {
    uncertainties.push("Serving size is not available, so daily impact cannot be calculated from per-100g values.");
  }
  if (todayAvailable) {
    evidence.push({
      kind: "personal_context",
      label: "Today's log",
      detail: `${ctx.today.consumedFoods.length} item${ctx.today.consumedFoods.length === 1 ? "" : "s"} logged on ${ctx.today.date ?? "today"}.`,
    });
  } else {
    evidence.push({
      kind: "personal_context",
      label: "Today's log",
      detail: "No food log available for today.",
    });
    uncertainties.push("Today's food context is unavailable, so remaining-budget figures are unknown.");
  }

  // ── Hard constraints ────────────────────────────────────────────────
  const constraintViolations = checkHardConstraints(profile, ctx);
  const blocking = hardViolations(constraintViolations);
  const hardConstraintViolation = blocking.length > 0;
  for (const v of constraintViolations) {
    evidence.push({ kind: "personal_context", label: "Stored restriction", detail: v.message });
  }

  // ── Goal alignment (only user-selected goals) ───────────────────────
  const goalAlignment = buildGoalAlignment(profile, ctx, impacts);

  // ── Deterministic fit ───────────────────────────────────────────────
  const { fit, reasons, uncertainties: fitUncertainties } = deriveFit(
    impacts,
    hardConstraintViolation,
    goalAlignment,
  );
  uncertainties.push(...fitUncertainties);

  return {
    productId: profile.productId,
    productName: profile.productName,
    hasPersonalContext: hasAnyPersonalContext(ctx),
    todayAvailable,
    servingGrams,
    impacts,
    constraintViolations,
    hardConstraintViolation,
    goalAlignment,
    fit,
    fitReasons: reasons,
    evidence,
    uncertainties: dedupe(uncertainties),
    targets: ctx.dailyTargets,
  };
}

function defaultUnit(key: ContextNutrientKey): string {
  return key === "calories" ? "kcal" : key === "sodium" ? "mg" : "g";
}

function hasAnyPersonalContext(ctx: UserFoodContext): boolean {
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

/**
 * Deterministic fit rules. Deliberately coarse (4 honest bands, not a
 * magical 0-100). The AI layer may rephrase `fitReasons` but cannot change
 * `fit` — it is computed entirely here.
 */
function deriveFit(
  impacts: NutrientImpact[],
  hardViolation: boolean,
  goals: GoalAlignment[],
): { fit: PersonalFit; reasons: string[]; uncertainties: string[] } {
  const reasons: string[] = [];
  const uncertainties: string[] = [];

  if (hardViolation) {
    return {
      fit: "CONFLICT",
      reasons: ["Conflicts with a restriction you stored."],
      uncertainties: [],
    };
  }

  const computable = impacts.filter((i) => i.shareOfRemaining !== null);
  if (computable.length === 0) {
    return {
      fit: "UNKNOWN",
      reasons: ["Not enough comparable data to place this in your day."],
      uncertainties: ["No nutrient could be compared against a daily target."],
    };
  }

  const maxShare = Math.max(...computable.map((i) => i.shareOfRemaining as number));
  const exceeded = computable.filter((i) => i.exceedsTarget === true);
  const supporting = goals.filter((g) => g.supports === true);
  const opposing = goals.filter((g) => g.supports === false);

  for (const i of computable.sort((a, b) => (b.shareOfRemaining ?? 0) - (a.shareOfRemaining ?? 0)).slice(0, 2)) {
    reasons.push(
      `Uses ${Math.round((i.shareOfRemaining ?? 0) * 100)}% of your remaining ${i.label.toLowerCase()} today.`,
    );
  }
  if (exceeded.length > 0) {
    reasons.push(`Would take you past today's target for ${exceeded.map((e) => e.label.toLowerCase()).join(", ")}.`);
  }
  if (supporting.length > 0) {
    reasons.push(`Supports your ${supporting[0].goal.replace(/_/g, " ")} goal.`);
  }
  if (opposing.length > 0) {
    reasons.push(`Works against your ${opposing[0].goal.replace(/_/g, " ")} goal.`);
  }

  let fit: PersonalFit;
  if (exceeded.length > 0 || opposing.length > 0) fit = "LOW";
  else if (maxShare >= 0.5 || (supporting.length > 0 && maxShare < 0.25)) fit = "MEDIUM";
  else fit = "HIGH";

  if (goals.length === 0) {
    uncertainties.push("No goal is set, so this is measured only against your daily reference targets.");
  }
  return { fit, reasons, uncertainties };
}

/**
 * Map the user's stored goals onto measured impacts. Only goals the user
 * actually selected appear; a goal with no comparable data is `null`
 * ("can't tell") rather than false.
 */
function buildGoalAlignment(
  profile: ProductFoodProfile,
  ctx: UserFoodContext,
  impacts: NutrientImpact[],
): GoalAlignment[] {
  const byKey = new Map(impacts.map((i) => [i.key, i]));
  const out: GoalAlignment[] = [];

  for (const goal of ctx.goals.healthGoals) {
    switch (goal) {
      case "weight_loss":
      case "lower_sugar": {
        const sugar = byKey.get("totalSugar");
        const supports = sugar?.productAmount == null ? null : sugar.productAmount <= 11;
        out.push({
          goal,
          supports,
          reason:
            supports === null
              ? "Sugar amount not available, so this goal cannot be assessed."
              : supports
                ? "Sugar per serving is at or below the app's per-100g reference threshold."
                : "Sugar per serving is above the app's per-100g reference threshold.",
          evidence: sugar?.productAmount != null ? [`${sugar.productAmount}${sugar.unit} sugar per serving`] : [],
        });
        break;
      }
      case "higher_protein": {
        const p = byKey.get("protein");
        out.push({
          goal,
          supports: p?.productAmount == null ? null : p.productAmount >= 6,
          reason:
            p?.productAmount == null
              ? "Protein not available, so this goal cannot be assessed."
              : `Provides ${p.productAmount}${p.unit} protein per serving.`,
          evidence: p?.productAmount != null ? [`${p.productAmount}${p.unit} protein per serving`] : [],
        });
        break;
      }
      case "higher_fibre":
      case "higher_fiber": {
        const f = byKey.get("fiber");
        out.push({
          goal,
          supports: f?.productAmount == null ? null : f.productAmount >= 3,
          reason:
            f?.productAmount == null
              ? "Fiber not available, so this goal cannot be assessed."
              : `Provides ${f.productAmount}${f.unit} fiber per serving.`,
          evidence: f?.productAmount != null ? [`${f.productAmount}${f.unit} fiber per serving`] : [],
        });
        break;
      }
      case "improve_nutrition": {
        const sodium = byKey.get("sodium");
        out.push({
          goal,
          supports: sodium?.productAmount == null ? null : sodium.productAmount <= 400,
          reason:
            sodium?.productAmount == null
              ? "Sodium not available, so this goal cannot be assessed."
              : `Contains ${sodium.productAmount}${sodium.unit} sodium per serving.`,
          evidence: sodium?.productAmount != null ? [`${sodium.productAmount}${sodium.unit} sodium per serving`] : [],
        });
        break;
      }
      case "avoid_processed": {
        // A conservative, non-numeric signal: presence of ingredients the
        // existing KB already marks as additives. Never a health claim.
        const additives = profile.ingredients.normalized.filter((name) => {
          const rec = ingredientIndexLookup(name.toLowerCase());
          return rec?.isAdditive === true;
        });
        out.push({
          goal,
          supports: additives.length === 0 ? null : additives.length < 3,
          reason:
            additives.length === 0
              ? "No known additives matched in the ingredient list."
              : `Ingredient list includes ${additives.length} known additive${additives.length === 1 ? "" : "s"}.`,
          evidence: additives.slice(0, 3),
        });
        break;
      }
      case "ingredient_avoidance":
        // Avoidance is enforced upstream as a hard constraint, not as a
        // numeric goal, so there is nothing further to measure here.
        out.push({
          goal,
          supports: null,
          reason: "Ingredient avoidance is enforced as a hard constraint.",
          evidence: [],
        });
        break;
      default:
        // Unknown stored goal: reported, never guessed at.
        out.push({
          goal,
          supports: null,
          reason: "FoodGuard has no measurement for this goal yet.",
          evidence: [],
        });
    }
  }
  return out;
}

function ingredientIndexLookup(name: string) {
  return ingredientIndex.resolveByCanonical(name) ?? ingredientIndex.resolveByAlias(name);
}

function dedupe(list: string[]): string[] {
  return [...new Set(list.filter(Boolean))];
}
