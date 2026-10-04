/**
 * Phase 5 — PersonalDecisionEngine.
 *
 * The orchestrator the UI talks to. It never renders, never calls a model
 * directly, and never trusts the model.
 *
 * Precedence, in order, and non-negotiable:
 *
 *   1. `fit` and `hardConstraintViolation` come from the deterministic
 *      engine and are COPIED into the result after JEV runs. A JEV response
 *      cannot change them because they are not parameters of its output.
 *   2. On any JEV failure the deterministic explanation is used and the
 *      product facts, calculations, and evidence remain fully visible
 *      (Step 18). The user is told the interpretation is unavailable rather
 *      than shown a silent downgrade.
 *   3. A JEV response that contradicts a proven hard-constraint violation,
 *      or that contains a health claim or an invented score, is DISCARDED
 *      and replaced by the deterministic explanation.
 *
 * Caching (Step 19) is three-layered and deliberately separated:
 *   - product profile  → cached by productId          (Phase 4, unchanged)
 *   - personal context → never cached; read fresh
 *   - decision         → cached by productId + a CONTEXT SIGNATURE
 * A cached decision is therefore invalidated the moment the user eats
 * something else or changes a goal, because the signature changes.
 */
import type { ProductFoodProfile } from "@/lib/multi-scan/food-profile";
import { analyzeContext, type ContextAnalysis, type PersonalFit } from "./context-engine";
import {
  buildJEVInput,
  containsBannedClaim,
  JEVOutputSchema,
  type JEVInput,
  type JEVOutput,
} from "./jev-contract";
import { getJEVAdapter, type JEVAdapter, type JEVFailureCode } from "./jev-adapter";
import { buildEvidenceList, buildReasoningChain, type ChainStep } from "./reasoning-chain";
import { contextSignature } from "./daily-log";
import type { UserFoodContext } from "./user-context";

/** The only shape the UI consumes (Step 6). */
export type PersonalDecision = {
  productId: string;
  productName: string;
  /** Deterministic. Never produced by the model. */
  fit: PersonalFit;
  /** Deterministic. JEV cannot clear this. */
  hardConstraintViolation: boolean;
  hardConstraints: ContextAnalysis["constraintViolations"];
  /** The contextual sentence the card leads with. */
  headline: string;
  /** Model phrasing when healthy, deterministic phrasing otherwise. */
  explanation: string;
  /** Who produced `explanation` — shown to the user for transparency. */
  explanationSource: "ai" | "deterministic";
  priorityFactors: string[];
  evidence: Array<{ kind: "product_fact" | "personal_context" | "calculation"; text: string }>;
  reasoningChain: ChainStep[];
  uncertainties: string[];
  analysis: ContextAnalysis;
  /** Set when JEV was attempted and did not deliver. */
  jevStatus:
    | { state: "ok"; source: "qwen" | "mock" }
    | { state: "unavailable"; code: JEVFailureCode }
    | { state: "rejected"; code: "banned_claim" | "contradicts_constraint" | "invalid" };
  /** True when this decision came from the decision cache. */
  fromCache: boolean;
};

export type PersonalDecisionEngineOptions = {
  jev?: JEVAdapter;
  /** Disable interpretation entirely (deterministic-only mode). */
  deterministicOnly?: boolean;
};

type CacheEntry = { signature: string; decision: PersonalDecision };

/**
 * Decision cache. Deliberately NOT one of the app's product caches
 * (`cache/product-cache.ts` etc.) — those are product-scoped and must never
 * hold user-scoped output.
 */
const decisionCache = new Map<string, CacheEntry>();

export function resetDecisionCacheForTesting(): void {
  decisionCache.clear();
}

export class PersonalDecisionEngine {
  private readonly jev: JEVAdapter;
  private readonly deterministicOnly: boolean;

  constructor(options: PersonalDecisionEngineOptions = {}) {
    this.jev = options.jev ?? getJEVAdapter();
    this.deterministicOnly = options.deterministicOnly === true;
  }

  /** Cache key: product identity + a signature of the context that matters. */
  private keyFor(profile: ProductFoodProfile, ctx: UserFoodContext): string {
    return `${profile.productId}::${contextSignature(ctx)}`;
  }

  /**
   * Produce a personal decision for one product.
   *
   * `force` bypasses the cache (used by the "See Why" refresh and by tests).
   */
  async decide(
    profile: ProductFoodProfile,
    ctx: UserFoodContext,
    options: { force?: boolean } = {},
  ): Promise<PersonalDecision> {
    // 1. Deterministic analysis — always runs, always authoritative.
    const analysis = analyzeContext(profile, ctx);

    // 2. Cache lookup keyed on the context signature.
    const key = this.keyFor(profile, ctx);
    if (!options.force) {
      const hit = decisionCache.get(key);
      if (hit && hit.signature === key) {
        return { ...hit.decision, fromCache: true };
      }
    }

    // 3. Interpretation, unless disabled.
    let decision: PersonalDecision;
    if (this.deterministicOnly) {
      decision = this.assemble(profile, ctx, analysis, null, {
        state: "unavailable",
        code: "jev_unavailable",
      });
    } else {
      const input = buildJEVInput(profile, ctx, analysis);
      const result = await this.interpret(input, analysis);
      if (result.ok) {
        decision = this.assemble(profile, ctx, analysis, result.output, {
          state: "ok",
          source: result.source,
        });
      } else if (result.rejection) {
        // The response arrived but was not trustworthy. Say so explicitly
        // rather than showing an indistinguishable silent fallback.
        decision = this.assemble(profile, ctx, analysis, null, {
          state: "rejected",
          code: result.rejection,
        });
      } else {
        // Step 18: deterministic evidence stays fully available.
        decision = this.assemble(profile, ctx, analysis, null, {
          state: "unavailable",
          code: result.code,
        });
      }
    }

    decisionCache.set(key, { signature: key, decision });
    return decision;
  }

  /**
   * Ask JEV, then re-validate its answer against the deterministic layer
   * before accepting a single word of it.
   */
  private async interpret(
    input: JEVInput,
    analysis: ContextAnalysis,
  ): Promise<
    | { ok: true; output: JEVOutput; source: "qwen" | "mock" }
    | { ok: false; code: JEVFailureCode; rejection?: "banned_claim" | "contradicts_constraint" }
  > {
    const result = await this.jev.interpret(input);
    if (!result.ok) return { ok: false, code: result.code };

    // (a) Schema — the adapter already checked, but re-check at the trust boundary.
    const parsed = JEVOutputSchema.safeParse(result.interpretation);
    if (!parsed.success) {
      return { ok: false, code: "invalid_jev_response" };
    }

    // (b) Banned claims / invented scores anywhere in the text.
    const allText = [
      parsed.data.explanation,
      ...parsed.data.priorityFactors,
      ...parsed.data.evidence,
    ].join(" ");
    if (containsBannedClaim(allText)) {
      return { ok: false, code: "invalid_jev_response", rejection: "banned_claim" };
    }

    // (c) Contradiction of a proven hard constraint.
    if (analysis.hardConstraintViolation && contradictsConstraint(parsed.data.explanation)) {
      return { ok: false, code: "invalid_jev_response", rejection: "contradicts_constraint" };
    }

    return { ok: true, output: parsed.data, source: result.source };
  }

  /** Merge deterministic analysis with an (optional) interpretation. */
  private assemble(
    profile: ProductFoodProfile,
    ctx: UserFoodContext,
    analysis: ContextAnalysis,
    interpretation: JEVOutput | null,
    jevStatus: PersonalDecision["jevStatus"],
  ): PersonalDecision {
    const deterministicExplanation =
      analysis.fitReasons[0] ??
      (analysis.hardConstraintViolation
        ? analysis.constraintViolations.find((c) => c.severity === "hard")?.message
        : null) ??
      "No personal context to compare against yet.";

    const explanation = interpretation
      ? interpretation.explanation
      : deterministicExplanation;

    return {
      productId: profile.productId,
      productName: profile.productName,
      // Deterministic values are assigned AFTER interpretation and are
      // never sourced from it.
      fit: analysis.fit,
      hardConstraintViolation: analysis.hardConstraintViolation,
      hardConstraints: analysis.constraintViolations,
      headline: headlineFor(analysis),
      explanation,
      explanationSource: interpretation ? "ai" : "deterministic",
      priorityFactors: interpretation ? interpretation.priorityFactors : analysis.fitReasons,
      evidence: buildEvidenceList(analysis),
      reasoningChain: buildReasoningChain(
        analysis,
        interpretation ? interpretation.explanation : null,
      ),
      uncertainties: dedupe([
        ...analysis.uncertainties,
        ...(interpretation?.uncertainties ?? []),
      ]),
      analysis,
      jevStatus,
      fromCache: false,
    };
  }
}

/** One short, contextual line for the card header. */
function headlineFor(analysis: ContextAnalysis): string {
  if (analysis.hardConstraintViolation) return "Conflicts with a restriction you set";
  switch (analysis.fit) {
    case "HIGH":
      return "Fits your current day";
    case "MEDIUM":
      return "Moderate fit for today";
    case "LOW":
      return "Uses a lot of your remaining budget";
    case "CONFLICT":
      return "Conflicts with a restriction you set";
    default:
      return "Not enough context to place this in your day";
  }
}

/**
 * Phrases that try to talk a proven constraint away. A violation is a fact
 * about the ingredient list, so any hedging about it is a bug, not nuance.
 */
const HEDGE_PATTERNS: RegExp[] = [
  /\b(probably|likely|maybe|possibly)\b[^.]{0,40}\b(ok|fine|safe|allergy|allergen|avoid|restrict)/i,
  /\bnot (really )?(a )?(big )?(concern|problem|issue)\b/i,
  /\bshould be fine\b/i,
  /\bin small amounts?\b/i,
];

function contradictsConstraint(explanation: string): boolean {
  return HEDGE_PATTERNS.some((re) => re.test(explanation));
}

function dedupe(list: string[]): string[] {
  return [...new Set(list.filter(Boolean))];
}
