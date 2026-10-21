/**
 * Phase 5 — reasoning chain ("See Why").
 *
 * Step 16 requires that a user can always tell which sentence came from the
 * product, which came from their own data, which was arithmetic, and which
 * was the AI. Rather than rendering a single blob of text, this module
 * produces that chain as data so the UI can lay it out step by step and so
 * tests can assert each hop independently.
 *
 * Every `value` in a calculation step is copied from the deterministic
 * engine. Nothing is recomputed here.
 */
import type { ContextAnalysis, NutrientImpact } from "./context-engine";

export type ChainStepKind = "context" | "product" | "calculation" | "target" | "result" | "interpretation";

export type ChainStep = {
  kind: ChainStepKind;
  /** Display label, e.g. "YOUR CONTEXT". */
  label: string;
  /** The value shown at this hop. */
  value: string;
  /** True only for the AI hop, so the UI can style it differently. */
  isAi: boolean;
  /** Set when a value is genuinely unknown. */
  unavailable?: boolean;
};

const fmt = (n: number | null, unit: string, decimals = 1): string =>
  n === null ? "Not available" : `${Number.isInteger(n) ? n : Number(n.toFixed(decimals))}${unit}`;

/**
 * Build the ordered reasoning chain for the most decision-relevant nutrient
 * (the one consuming the largest share of the remaining budget), or the
 * first available nutrient when nothing is comparable.
 */
export function buildReasoningChain(
  analysis: ContextAnalysis,
  interpretation: string | null,
): ChainStep[] {
  const steps: ChainStep[] = [];

  if (analysis.hardConstraintViolation) {
    const v = analysis.constraintViolations.find((c) => c.severity === "hard")!;
    steps.push(
      { kind: "context", label: "YOUR CONTEXT", value: v.preference, isAi: false },
      { kind: "product", label: "PRODUCT", value: v.ingredient, isAi: false },
      { kind: "calculation", label: "CHECK", value: "Ingredient list contains this item", isAi: false },
      {
        kind: "result",
        label: "RESULT",
        value: "Conflicts with a restriction you stored",
        isAi: false,
      },
    );
    steps.push({
      kind: "interpretation",
      label: "AI INTERPRETATION",
      value: interpretation ?? analysis.fitReasons[0] ?? "No AI interpretation available.",
      isAi: interpretation !== null,
    });
    return steps;
  }

  const impact = pickPrimaryImpact(analysis.impacts);
  if (!impact) {
    steps.push({
      kind: "context",
      label: "YOUR CONTEXT",
      value: analysis.todayAvailable
        ? "Today's log available"
        : "Today's food context unavailable",
      isAi: false,
      unavailable: !analysis.todayAvailable,
    });
    steps.push({
      kind: "result",
      label: "RESULT",
      value: analysis.fitReasons[0] ?? "Not enough comparable data.",
      isAi: false,
    });
    if (interpretation) {
      steps.push({
        kind: "interpretation",
        label: "AI INTERPRETATION",
        value: interpretation,
        isAi: true,
      });
    }
    return steps;
  }

  // 1. User context
  steps.push({
    kind: "context",
    label: "YOUR CONTEXT",
    value:
      impact.consumedBefore !== null
        ? `${fmt(impact.consumedBefore, impact.unit)} ${impact.label.toLowerCase()} consumed today`
        : "Today's food context unavailable",
    isAi: false,
    unavailable: impact.consumedBefore === null,
  });

  // 2. Product fact
  steps.push({
    kind: "product",
    label: "PRODUCT",
    value:
      impact.productAmount !== null
        ? `${fmt(impact.productAmount, impact.unit)} ${impact.label.toLowerCase()} per serving`
        : `${impact.label} not reported by the product`,
    isAi: false,
    unavailable: impact.productAmount === null,
  });

  // 3. Arithmetic — only when both operands exist
  if (impact.consumedBefore !== null && impact.productAmount !== null) {
    steps.push({
      kind: "calculation",
      label: "CALCULATION",
      value: `${impact.consumedBefore} + ${impact.productAmount} = ${fmt(
        impact.consumedBefore + impact.productAmount,
        impact.unit,
      )}`,
      isAi: false,
    });
  } else {
    steps.push({
      kind: "calculation",
      label: "CALCULATION",
      value: "Not possible — required values are unavailable",
      isAi: false,
      unavailable: true,
    });
  }

  // 4. Target
  steps.push({
    kind: "target",
    label: "TARGET",
    value:
      impact.target !== null
        ? `${fmt(impact.target, impact.unit)} per day (${analysis.targets.values[impact.key]?.source ?? "app reference"})`
        : "No daily target for this nutrient",
    isAi: false,
    unavailable: impact.target === null,
  });

  // 5. Result
  if (impact.remainingAfter !== null) {
    steps.push({
      kind: "result",
      label: "RESULT",
      value: `${fmt(impact.remainingAfter, impact.unit)} remaining${
        impact.shareOfRemaining !== null
          ? ` · uses ${Math.round(impact.shareOfRemaining * 100)}% of what was left`
          : ""
      }`,
      isAi: false,
    });
  } else {
    steps.push({
      kind: "result",
      label: "RESULT",
      value: "Not available for this nutrient",
      isAi: false,
      unavailable: true,
    });
  }

  // 6. AI interpretation
  steps.push({
    kind: "interpretation",
    label: "AI INTERPRETATION",
    value: interpretation ?? analysis.fitReasons[0] ?? "No AI interpretation available.",
    isAi: interpretation !== null,
  });

  return steps;
}

/**
 * The nutrient that best explains the decision: the largest share of the
 * remaining budget, or the highest remaining value when no share exists.
 */
function pickPrimaryImpact(impacts: NutrientImpact[]): NutrientImpact | null {
  const withShare = impacts.filter((i) => i.shareOfRemaining !== null);
  if (withShare.length > 0) {
    return withShare.sort((a, b) => (b.shareOfRemaining ?? 0) - (a.shareOfRemaining ?? 0))[0];
  }
  const withAmount = impacts.filter((i) => i.productAmount !== null && i.consumedBefore !== null);
  if (withAmount.length > 0) return withAmount[0];
  return null;
}

/**
 * Full evidence list for the "Evidence" section, each tagged with whether it
 * is a product fact, personal context, or a calculation.
 */
export function buildEvidenceList(analysis: ContextAnalysis): Array<{
  kind: "product_fact" | "personal_context" | "calculation";
  text: string;
}> {
  const out: Array<{ kind: "product_fact" | "personal_context" | "calculation"; text: string }> = [];
  for (const e of analysis.evidence) out.push({ kind: e.kind, text: e.detail });

  for (const i of analysis.impacts) {
    if (i.productAmount === null) continue;
    if (i.remainingAfter !== null) {
      out.push({
        kind: "calculation",
        text: `${i.label}: ${i.productAmount}${i.unit} per serving → ${i.remainingAfter}${i.unit} remaining today`,
      });
    } else if (i.consumedBefore !== null) {
      out.push({
        kind: "product_fact",
        text: `${i.label}: ${i.productAmount}${i.unit} per serving`,
      });
    }
  }
  return out;
}
