/**
 * Server-side acceptance gate for the JEV interpretation layer.
 *
 * Extracted from the route so it is unit-testable in this repo's node test
 * environment. The route is the last place the interpretation layer can be
 * stopped, so its rules are covered directly rather than only through the
 * client-side engine.
 *
 * Defense in depth is intentional: the decision engine re-checks everything
 * here before display. These checks exist so a bad interpretation never even
 * reaches the client, and so a future caller cannot forget to check.
 */

/** Phrases that try to talk a proven hard-constraint violation away. */
const DOWNGRADE_PATTERNS: RegExp[] = [
  /\b(probably|likely|maybe|possibly)\b/i,
  /\bshould be (ok|okay|fine)\b/i,
  /\b(is|are) (fine|ok|okay)\b/i,
  /\bnot (really )?(a )?(big )?(concern|problem|issue)\b/i,
  /\bin small amounts?\b/i,
  /\bprobably fine\b/i,
];

/** True when text hedges away a constraint that was already proven. */
export function downgradesConstraint(text: string): boolean {
  return DOWNGRADE_PATTERNS.some((re) => re.test(text));
}

export type JEVGateFailure = {
  ok: false;
  status: 502;
  code: "INVALID_JEV_RESPONSE" | "JEV_OVERRODE_CONSTRAINT" | "JEV_BANNED_CLAIM";
};

export type JEVGateSuccess = { ok: true };

/**
 * Decide whether a schema-valid interpretation may be returned.
 *
 * `containsBannedClaim` is injected rather than imported so the gate tests
 * the gate, not the pattern list (which the contract tests already cover).
 */
export function acceptInterpretation(
  interpretation: {
    explanation: string;
    priorityFactors: string[];
    evidence: string[];
  },
  options: {
    hardConstraintViolation: boolean;
    containsBannedClaim: (text: string) => boolean;
  },
): JEVGateSuccess | JEVGateFailure {
  // (1) A proven violation may not be softened. The violation is a fact about
  // the ingredient list, so hedging about it is a bug, not nuance.
  if (options.hardConstraintViolation) {
    const text = `${interpretation.explanation} ${interpretation.priorityFactors.join(" ")}`;
    if (downgradesConstraint(text)) {
      return { ok: false, status: 502, code: "JEV_OVERRODE_CONSTRAINT" };
    }
  }

  // (2) No health claims, no invented 0-100 scores, anywhere in the output.
  const all = [
    interpretation.explanation,
    ...interpretation.priorityFactors,
    ...interpretation.evidence,
  ];
  if (all.some((s) => options.containsBannedClaim(s))) {
    return { ok: false, status: 502, code: "JEV_BANNED_CLAIM" };
  }

  return { ok: true };
}
