/**
 * Pure orchestration behind `usePersonalDecisions`.
 *
 * Kept out of the hook so the fan-out, staleness, and merge behaviour can be
 * unit-tested in the node environment this repo uses (no DOM, no testing-library).
 */
import type { ProductFoodProfile } from "@/lib/multi-scan/food-profile";
import type { PersonalDecision, PersonalDecisionEngine } from "./decision-engine";
import type { UserFoodContext } from "./user-context";

export type DecisionOutcome =
  | { ok: true; productId: string; decision: PersonalDecision }
  | { ok: false; productId: string; error: string };

/**
 * Decide every profile concurrently. One product's failure never removes
 * another product's result.
 */
export async function decideAll(
  engine: Pick<PersonalDecisionEngine, "decide">,
  profiles: ProductFoodProfile[],
  ctx: UserFoodContext,
  options: { force?: boolean } = {},
): Promise<DecisionOutcome[]> {
  return Promise.all(
    profiles.map(async (p): Promise<DecisionOutcome> => {
      try {
        const decision = await engine.decide(p, ctx, options);
        return { ok: true, productId: p.productId, decision };
      } catch (e: unknown) {
        return {
          ok: false,
          productId: p.productId,
          error: e instanceof Error ? e.message : "Failed to compute personal fit",
        };
      }
    }),
  );
}

/**
 * Merge outcomes into a decision map, preserving previously computed results
 * for products not in this batch. Returns the first error encountered so the
 * UI can surface it without hiding the successes.
 */
export function mergeOutcomes(
  previous: Map<string, PersonalDecision>,
  outcomes: DecisionOutcome[],
): { byProductId: Map<string, PersonalDecision>; error: string | null } {
  const byProductId = new Map(previous);
  let error: string | null = null;
  for (const o of outcomes) {
    if (o.ok) byProductId.set(o.productId, o.decision);
    else if (error === null) error = o.error;
  }
  return { byProductId, error };
}

/** Product ids currently being computed. */
export function pendingIds(profiles: ProductFoodProfile[]): Set<string> {
  return new Set(profiles.map((p) => p.productId));
}
