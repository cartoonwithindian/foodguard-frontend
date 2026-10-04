/**
 * Phase 5 — JEV (Justify Every Value) contracts.
 *
 * "JEV" is the interpretation layer that turns already-computed evidence
 * into a sentence a person can read. It is deliberately the WEAKEST layer in
 * the system:
 *
 *   1. It never receives an API key, a user id, an email, a token, an
 *      account identifier, or any raw personal field. `buildJEVInput()`
 *      constructs the payload from an allowlist, so privacy is a property of
 *      the type, not a review promise.
 *   2. It never receives raw nutrition it could recompute. It receives the
 *      deterministic engine's OUTPUT, so the numbers it talks about are
 *      already decided.
 *   3. It cannot change `fit` or the presence of a hard-constraint
 *      violation. Those are not parameters of its output.
 *   4. Its output is Zod-validated. Anything that fails validation is
 *      discarded and the deterministic explanation is shown instead.
 *
 * The naming is literal: every `evidence` entry JEV returns must be
 * quotable back to a field that was actually sent to it.
 */
import { z } from "zod";
import type { ProductFoodProfile } from "@/lib/multi-scan/food-profile";
import type { ContextAnalysis, NutrientImpact } from "./context-engine";
import type { UserFoodContext } from "./user-context";
import type { ContextNutrientKey } from "./user-context";

/** Nutrients actually sent to JEV. A small, fixed allowlist. */
export const JEV_NUTRIENT_KEYS: ContextNutrientKey[] = [
  "totalSugar",
  "addedSugar",
  "protein",
  "fiber",
  "sodium",
  "saturatedFat",
  "calories",
];

/** One pre-computed number pair handed to JEV. */
export const JEVImpactSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    unit: z.string(),
    productAmount: z.number().nullable(),
    consumedBefore: z.number().nullable(),
    target: z.number().nullable(),
    remainingBefore: z.number().nullable(),
    remainingAfter: z.number().nullable(),
    /** Already a fraction in [0,1]. JEV must not recompute this. */
    shareOfRemaining: z.number().nullable(),
    unavailableReason: z.string().nullable(),
  })
  .strict();

export type JEVImpact = z.infer<typeof JEVImpactSchema>;

/**
 * The full, privacy-minimal payload sent to the interpretation layer.
 *
 * `.strict()` on every level is deliberate and load-bearing. Zod's default is
 * to silently *strip* unknown keys, which would mean a caller adding
 * `userId` or `email` gets a cheerful 200 and no error — the field would not
 * reach the model, but the caller would never learn it was wrong. Strict
 * turns that into a hard 400 at the boundary, so an attempt to widen the
 * payload is a visible failure instead of a silent one.
 */
export const JEVInputSchema = z
  .object({
    product: z
      .object({
        name: z.string().min(1),
        /** Ingredient names only — the raw label string is not sent. */
        ingredients: z.array(z.string()).max(60),
        servingSize: z.string().nullable(),
        nutritionBasis: z.string().nullable(),
      })
      .strict(),
    userContext: z
      .object({
        /** Only goals the user explicitly selected. */
        goals: z.array(z.string()).max(12),
        dietaryPreferences: z.array(z.string()).max(12),
        /** Counts and the day's date only — never the full food log. */
        today: z
          .object({
            available: z.boolean(),
            itemsLogged: z.number().int().min(0),
            date: z.string().nullable(),
          })
          .strict(),
      })
      .strict(),
    deterministicAnalysis: z
      .object({
        fit: z.enum(["HIGH", "MEDIUM", "LOW", "CONFLICT", "UNKNOWN"]),
        impacts: z.array(JEVImpactSchema).max(20),
        hardConstraintViolation: z.boolean(),
        /** Reasons are passed so JEV phrases them rather than inventing them. */
        hardConstraintReasons: z.array(z.string()).max(10),
        deterministicReasons: z.array(z.string()).max(10),
        uncertainties: z.array(z.string()).max(10),
      })
      .strict(),
  })
  .strict();

export type JEVInput = z.infer<typeof JEVInputSchema>;

/** JEV output. Deliberately narrow: it may only phrase what it was given. */
export const JEVOutputSchema = z.object({
  /**
   * A contextual sentence, not a verdict word. Explicitly typed as a string
   * so there is no "healthy/unhealthy" enum to reach for.
   */
  explanation: z.string().min(1).max(600),
  /** Short phrases naming what drove the explanation. */
  priorityFactors: z.array(z.string().max(120)).max(6).default([]),
  /**
   * Every entry must correspond to a value present in the input. The
   * decision engine verifies this and drops anything unsupported.
   */
  evidence: z.array(z.string().max(160)).max(8).default([]),
  /** Things JEV is unsure about. Rendered, never hidden. */
  uncertainties: z.array(z.string().max(160)).max(6).default([]),
});

export type JEVOutput = z.infer<typeof JEVOutputSchema>;

/** Phrases that would turn an interpretation into a health claim. */
const BANNED_CLAIM_PATTERNS: RegExp[] = [
  /\b(healthy|unhealthy|good for you|bad for you|you should|you must|recommend|avoid this|perfect for)\b/i,
  /\b(\d{1,3})\s*\/\s*100\b/, // invented 0-100 score
  /\b(score of|rated|rating of)\b/i,
];

/** True when output contains a claim the interpretation layer may not make. */
export function containsBannedClaim(text: string): boolean {
  return BANNED_CLAIM_PATTERNS.some((re) => re.test(text));
}

function toJEVImpact(i: NutrientImpact): JEVImpact {
  return {
    key: i.key,
    label: i.label,
    unit: i.unit,
    productAmount: i.productAmount,
    consumedBefore: i.consumedBefore,
    target: i.target,
    remainingBefore: i.remainingBefore,
    remainingAfter: i.remainingAfter,
    shareOfRemaining: i.shareOfRemaining,
    unavailableReason: i.unavailableReason,
  };
}

const GOAL_LABELS: Record<string, string> = {
  weight_loss: "lower weight",
  lower_sugar: "lower sugar",
  higher_protein: "higher protein",
  higher_fibre: "higher fibre",
  higher_fiber: "higher fibre",
  improve_nutrition: "improved nutrition",
  avoid_processed: "less processed food",
  ingredient_avoidance: "ingredient avoidance",
};

/**
 * Build the JEV payload from an allowlist.
 *
 * Excluded on purpose: user id, email, name, auth token, internal ids,
 * device metadata, the raw ingredient string, and the full consumed-foods
 * list (only a count and the date are sent).
 */
export function buildJEVInput(
  profile: ProductFoodProfile,
  ctx: UserFoodContext,
  analysis: ContextAnalysis,
): JEVInput {
  const dietaryPreferences: string[] = [];
  if (ctx.restrictions.vegan) dietaryPreferences.push("vegan");
  if (ctx.restrictions.vegetarian) dietaryPreferences.push("vegetarian");
  dietaryPreferences.push(...ctx.restrictions.dietaryRestrictions);
  // Allergy/avoid lists are reduced to counts; the deterministic layer has
  // already applied them as hard constraints.
  if (ctx.restrictions.allergies.length > 0) {
    dietaryPreferences.push(`${ctx.restrictions.allergies.length} declared allergen(s)`);
  }
  if (ctx.restrictions.avoidIngredients.length > 0) {
    dietaryPreferences.push(`${ctx.restrictions.avoidIngredients.length} avoided ingredient(s)`);
  }

  const keySet = new Set<string>(JEV_NUTRIENT_KEYS);
  const impacts = analysis.impacts
    .filter((i) => keySet.has(i.key))
    .map(toJEVImpact);

  return JEVInputSchema.parse({
    product: {
      name: profile.productName,
      ingredients: profile.ingredients.normalized.slice(0, 60),
      servingSize: profile.servingSize ?? null,
      nutritionBasis: profile.nutrition.basis,
    },
    userContext: {
      goals: ctx.goals.healthGoals.slice(0, 12),
      dietaryPreferences: dietaryPreferences.slice(0, 12),
      today: {
        available: ctx.today.available,
        itemsLogged: ctx.today.consumedFoods.length,
        date: ctx.today.date,
      },
    },
    deterministicAnalysis: {
      fit: analysis.fit,
      impacts,
      hardConstraintViolation: analysis.hardConstraintViolation,
      hardConstraintReasons: analysis.constraintViolations
        .filter((v) => v.severity === "hard" && v.determined)
        .map((v) => v.message)
        .slice(0, 10),
      deterministicReasons: analysis.fitReasons.slice(0, 10),
      uncertainties: analysis.uncertainties.slice(0, 10),
    },
  });
}

/** Human-readable goal label for display. */
export function goalLabel(goal: string): string {
  return GOAL_LABELS[goal] ?? goal.replace(/_/g, " ");
}
