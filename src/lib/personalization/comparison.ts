/**
 * Phase 5 — multi-product comparison (Step 14).
 *
 * The rule this module exists to enforce: FoodGuard must NOT declare a
 * universal "best" product. "Best" is undefined until the user supplies a
 * criterion, so this module only ever compares products *alongside* the
 * user's own stated goals, and explicitly reports when no goal was set.
 *
 * Comparisons are made on the deterministic impacts already computed by the
 * context engine. Nothing is recomputed here, and nothing is inferred.
 */
import type { PersonalDecision } from "./decision-engine";
import type { ContextNutrientKey, UserFoodContext } from "./user-context";

/** Which direction counts as "better" for a given nutrient. */
const NUTRIENT_DIRECTION: Partial<Record<ContextNutrientKey, "lower" | "higher">> = {
  totalSugar: "lower",
  addedSugar: "lower",
  sodium: "lower",
  saturatedFat: "lower",
  fat: "lower",
  calories: "lower",
  protein: "higher",
  fiber: "higher",
};

export type ComparisonRow = {
  key: ContextNutrientKey;
  label: string;
  unit: string;
  /** Per-product per-serving amount, null when not reported. */
  values: Array<number | null>;
  /** Which direction is better; null when the nutrient has no direction. */
  betterDirection: "lower" | "higher" | null;
  /** Index into `values` of the best product, when one is determinable. */
  bestIndex: number | null;
  /** True when values tie, so no single best exists. */
  tied: boolean;
  unavailableReason: string | null;
};

export type ComparisonColumn = {
  productId: string;
  productName: string;
  fit: PersonalDecision["fit"];
  hardConstraintViolation: boolean;
};

export type ProductComparison = {
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
  /** Products excluded from ranking because of a hard-constraint violation. */
  conflictingProductIds: string[];
  /** Set only when the user actually selected a goal. */
  goalCriterion: string | null;
  /**
   * Populated ONLY when a user goal defines a ranking. With no goal there is
   * no criterion, so no winner is named — by design, not by omission.
   */
  bestForGoalProductId: string | null;
  /** Honest note rendered under the table. */
  note: string;
};

const COMPARABLE_KEYS: ContextNutrientKey[] = [
  "totalSugar",
  "addedSugar",
  "sodium",
  "saturatedFat",
  "protein",
  "fiber",
  "calories",
];

/**
 * Build a per-goal comparison table.
 *
 * A product with a hard-constraint violation is never ranked as a winner,
 * no matter how good its numbers are.
 */
export function compareProducts(
  decisions: PersonalDecision[],
  ctx: UserFoodContext,
): ProductComparison {
  const columns: ComparisonColumn[] = decisions.map((d) => ({
    productId: d.productId,
    productName: d.productName,
    fit: d.fit,
    hardConstraintViolation: d.hardConstraintViolation,
  }));

  const conflictingProductIds = decisions
    .filter((d) => d.hardConstraintViolation)
    .map((d) => d.productId);

  // A goal must be both selected AND one we can actually rank on.
  const rankableGoal = ctx.goals.healthGoals.find((g) =>
    g === "weight_loss" || g === "lower_sugar" || g === "higher_protein" || g === "higher_fibre" || g === "higher_fiber",
  );

  // Step 14: no goal means no criterion, so no "best" is named at all — not
  // per row and not overall. This is a deliberate refusal, not a gap.
  const goalKey: ContextNutrientKey | null = rankableGoal
    ? rankableGoal === "higher_protein"
      ? "protein"
      : rankableGoal === "higher_fibre" || rankableGoal === "higher_fiber"
        ? "fiber"
        : "totalSugar"
    : null;

  // A product that violates a stored restriction is never eligible to be
  // named best, however good its numbers are.
  const eligible = decisions.map((d) => !d.hardConstraintViolation);

  const rows: ComparisonRow[] = [];
  for (const key of COMPARABLE_KEYS) {
    const values = decisions.map(
      (d) => d.analysis.impacts.find((i) => i.key === key)?.productAmount ?? null,
    );
    const meta = decisions[0]?.analysis.impacts.find((i) => i.key === key);
    const betterDirection = NUTRIENT_DIRECTION[key] ?? null;

    let bestIndex: number | null = null;
    let tied = false;
    const rankable = key === goalKey;
    const known = values.filter((v, i): v is number => v !== null && eligible[i]);

    if (rankable && betterDirection && known.length >= 1 && decisions.length >= 2) {
      const best = betterDirection === "lower" ? Math.min(...known) : Math.max(...known);
      const winners = values
        .map((v, i) => (eligible[i] && v === best ? i : -1))
        .filter((i) => i >= 0);
      tied = winners.length > 1;
      bestIndex = tied ? null : winners[0];
    }

    rows.push({
      key,
      label: meta?.label ?? key,
      unit: meta?.unit ?? "g",
      values,
      betterDirection,
      bestIndex,
      tied,
      unavailableReason: known.length === 0 ? (meta?.unavailableReason ?? null) : null,
    });
  }

  const goalRow = goalKey ? rows.find((r) => r.key === goalKey) : null;
  const bestForGoalProductId =
    goalRow && goalRow.bestIndex !== null ? decisions[goalRow.bestIndex].productId : null;

  const note = !rankableGoal
    ? "No goal is set, so FoodGuard is not ranking these products. Set a goal to compare them against it."
    : conflictingProductIds.length > 0
      ? "Products conflicting with a restriction you set are excluded from ranking."
      : `Ranked against your ${rankableGoal.replace(/_/g, " ")} goal only.`;

  return {
    columns,
    rows,
    conflictingProductIds,
    goalCriterion: rankableGoal ?? null,
    bestForGoalProductId,
    note,
  };
}
