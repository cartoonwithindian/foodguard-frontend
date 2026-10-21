/**
 * Phase 5 — hard constraints.
 *
 * These are the checks the AI interpretation layer is NOT allowed to argue
 * with. If the user explicitly told FoodGuard they avoid something and the
 * product contains it, that is a fact, not a judgement call.
 *
 * Every rule here is deterministic and grounded in explicitly stored user
 * data. Notably ABSENT: any inference of medical conditions, allergies, or
 * health needs. An allergen only counts if the user stored it in
 * `preferences.allergies`; FoodGuard never guesses one from a product.
 *
 * Reuse notes — this mirrors `services/personalization.service.ts` so the
 * two layers cannot disagree:
 *  - same `normalizeText()` matcher from `@/lib/ingredients`
 *  - same `DIET_CONFLICT_HINTS` forbidden-status sets
 *  - same KB: `ingredientIndex` (the client-safe static seed), which is the
 *    same `IngredientRecord.dietaryStatus` data the store serves
 *  - same severity semantics: declared-contains = hard, may-contain = soft
 *    advisory
 */
import { ingredientIndex, normalizeText } from "@/lib/ingredients";
import type { ProductFoodProfile } from "@/lib/multi-scan/food-profile";
import type { UserFoodContext } from "./user-context";

/** Mirrors DIET_CONFLICT_HINTS in services/personalization.service.ts. */
const DIET_FORBIDDEN_STATUS: Record<"vegan" | "vegetarian", string[]> = {
  vegan: ["not_vegan", "contains_dairy", "contains_egg"],
  vegetarian: ["not_vegan", "contains_dairy", "contains_egg"],
};

export type HardConstraintKind =
  | "declared_allergen"
  | "avoided_ingredient"
  | "dietary_restriction"
  | "vegan"
  | "vegetarian";

export type HardConstraintSeverity = "hard" | "advisory";

export type HardConstraintViolation = {
  kind: HardConstraintKind;
  /** The matched ingredient, canonical when the KB resolved it. */
  ingredient: string;
  /** Which stored user preference produced this. */
  preference: string;
  severity: HardConstraintSeverity;
  /** User-facing, non-alarming wording. */
  message: string;
  /** Where the product-side evidence came from. */
  evidence: "ingredients";
  /** Whether the KB positively knows this ingredient's diet status. */
  determined: boolean;
};

/**
 * Ingredient text that signals a "may contain" / cross-contact statement.
 * Used only to soften a declared allergen to advisory — never to create one.
 */
const MAY_CONTAIN_RE =
  /\b(may\s+contain|may\s+have|traces?\s+of|possible\s+trace|cross[\s-]?contaminat|processed\s+(in|at|with))\b/i;

function resolveRecord(ingredient: string) {
  const n = normalizeText(ingredient);
  return (
    ingredientIndex.resolveByCanonical(n) ??
    ingredientIndex.resolveByAlias(n) ??
    undefined
  );
}

/**
 * Deterministic hard-constraint check.
 *
 * Returns every violation found, ordered most-severe-first. An empty array
 * is a valid, meaningful result: "no stored restriction is violated".
 *
 * `determined: false` marks a case where the KB could not resolve the
 * ingredient's diet status — the UI reports that honestly instead of
 * claiming the product is vegan.
 */
export function checkHardConstraints(
  profile: ProductFoodProfile,
  ctx: UserFoodContext,
): HardConstraintViolation[] {
  const violations: HardConstraintViolation[] = [];
  const ingredients = profile.ingredients.normalized;
  if (ingredients.length === 0) return violations;

  const rawText = profile.ingredients.rawText;
  const avoid = new Set(ctx.restrictions.avoidIngredients.map(normalizeText));
  const allergies = new Set(
    ctx.restrictions.allergies.flatMap((a) => {
      const n = normalizeText(a);
      return [n, n.replace(/_/g, " ")];
    }),
  );
  const restrictions = new Set(ctx.restrictions.dietaryRestrictions.map(normalizeText));
  const wantsVegan = ctx.restrictions.vegan;
  const wantsVegetarian = ctx.restrictions.vegetarian;

  const seen = new Set<string>();
  const push = (v: HardConstraintViolation) => {
    const key = `${v.kind}:${normalizeText(v.ingredient)}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push(v);
  };

  for (const ingredient of ingredients) {
    const key = normalizeText(ingredient);
    const record = resolveRecord(ingredient);

    // 1) Declared allergy present in the ingredient list.
    if (allergies.has(key) || allergies.has(key.replace(/_/g, " "))) {
      const precautionary = MAY_CONTAIN_RE.test(rawText);
      push({
        kind: "declared_allergen",
        ingredient: record?.canonicalName ?? ingredient,
        preference: ingredient,
        severity: precautionary ? "advisory" : "hard",
        message: precautionary
          ? `The label mentions ${record?.canonicalName ?? ingredient}, which is in your allergy list. May be present through cross-contact — worth checking.`
          : `${record?.canonicalName ?? ingredient} is in your allergy list and appears in this product's ingredients.`,
        evidence: "ingredients",
        determined: true,
      });
    }

    // 2) Explicitly avoided ingredient.
    if (avoid.has(key)) {
      push({
        kind: "avoided_ingredient",
        ingredient: record?.canonicalName ?? ingredient,
        preference: ingredient,
        severity: "hard",
        message: `Contains ${record?.canonicalName ?? ingredient}, which you chose to avoid.`,
        evidence: "ingredients",
        determined: true,
      });
    }

    if (!record) continue;
    const statuses = record.dietaryStatus ?? [];

    // 3) Vegan / vegetarian.
    if (wantsVegan) {
      const conflict = DIET_FORBIDDEN_STATUS.vegan.some((s) => statuses.includes(s));
      if (conflict) {
        push({
          kind: "vegan",
          ingredient: record.canonicalName,
          preference: "vegan",
          severity: "hard",
          message: `Contains ${record.canonicalName}, which is not suitable for a vegan diet.`,
          evidence: "ingredients",
          determined: true,
        });
      }
    }
    if (wantsVegetarian && !wantsVegan) {
      const conflict = DIET_FORBIDDEN_STATUS.vegetarian.some((s) => statuses.includes(s));
      if (conflict) {
        push({
          kind: "vegetarian",
          ingredient: record.canonicalName,
          preference: "vegetarian",
          severity: "hard",
          message: `Contains ${record.canonicalName}, which is not suitable for a vegetarian diet.`,
          evidence: "ingredients",
          determined: true,
        });
      }
    }

    // 4) User-declared dietary restriction matching the KB.
    for (const restriction of restrictions) {
      const r = normalizeText(restriction);
      const matches =
        statuses.some((s) => normalizeText(s) === r) ||
        normalizeText(record.canonicalName) === r ||
        record.aliases.some((a) => normalizeText(a.alias) === r);
      if (matches) {
        push({
          kind: "dietary_restriction",
          ingredient: record.canonicalName,
          preference: restriction,
          severity: "hard",
          message: `Contains ${record.canonicalName}, which conflicts with your dietary restriction (${restriction}).`,
          evidence: "ingredients",
          determined: true,
        });
      }
    }
  }

  // Hard violations first, then advisory.
  return violations.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "hard" ? -1 : 1));
}

/**
 * The single boolean JEV is forbidden to argue with. True when at least one
 * stored user restriction is violated by a determined ingredient match.
 */
export function hasHardViolation(violations: HardConstraintViolation[]): boolean {
  return violations.some((v) => v.severity === "hard" && v.determined);
}

/** Only the blocking violations, for the decision layer. */
export function hardViolations(
  violations: HardConstraintViolation[],
): HardConstraintViolation[] {
  return violations.filter((v) => v.severity === "hard" && v.determined);
}
