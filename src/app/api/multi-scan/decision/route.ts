import { getAIProvider, PersonalDecisionInterpretationSchema } from "@/lib/ai";
import { isAIReady } from "@/lib/config";
import { JEVInputSchema, containsBannedClaim } from "@/lib/personalization/jev-contract";
import { acceptInterpretation } from "@/lib/personalization/jev-gate";

/**
 * POST /api/multi-scan/decision
 *
 * Server-side JEV invocation for the Phase 5 decision layer.
 *
 * Architecture (Step 6): the browser never calls a model directly. The
 * `PersonalDecisionEngine` computes the deterministic analysis client-side,
 * sends ONLY the resulting JEVInput allowlist here, and this route turns it
 * into an interpretation.
 *
 * Privacy (Step 21): the body is validated against `JEVInputSchema`, whose
 * shape has no field for a user id, email, token, or account identifier, so
 * an over-eager caller cannot smuggle one into a model prompt. The
 * deterministic numbers are supplied by the caller, and this route
 * re-validates the interpretation on the way out.
 *
 * Failure (Step 18): any provider error, malformed JSON, schema violation,
 * or banned health claim returns a typed failure. The client then shows the
 * deterministic explanation, which never depends on this route succeeding.
 */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let raw: unknown = null;
  try {
    raw = await request.json();
  } catch {
    return fail(400, "INVALID_REQUEST", "Request body must be JSON.");
  }

  // Validate BEFORE touching the provider: this is the privacy boundary.
  const parsed = JEVInputSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(400, "INVALID_INPUT", "Decision input did not match the expected schema.");
  }
  const input = parsed.data;

  try {
    const provider = getAIProvider();
    if (!provider.interpretPersonalDecision) {
      return fail(503, "JEV_UNAVAILABLE", "Personalized AI interpretation temporarily unavailable.");
    }

    const raw_ = await provider.interpretPersonalDecision(input);

    // Second validation on the way out — the provider is not trusted to have
    // honoured the prompt, only the schema.
    const result = PersonalDecisionInterpretationSchema.safeParse(raw_);
    if (!result.success) {
      return fail(502, "INVALID_JEV_RESPONSE", "Personalized AI interpretation unavailable.");
    }

    // Hard-constraint integrity and claim filtering live in a testable module
    // so this boundary is covered by unit tests, not only by inspection.
    const gate = acceptInterpretation(result.data, {
      hardConstraintViolation: input.deterministicAnalysis.hardConstraintViolation,
      containsBannedClaim,
    });
    if (!gate.ok) {
      return fail(gate.status, gate.code, "Personalized AI interpretation unavailable.");
    }

    return Response.json({
      success: true,
      data: {
        interpretation: result.data,
        source: isAIReady() ? "qwen" : "mock",
      },
      error: null,
      meta: { requestId: "multi-scan-decision" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const invalid = /invalid json/i.test(message);
    return fail(
      invalid ? 500 : 503,
      invalid ? "INVALID_JEV_RESPONSE" : "JEV_ERROR",
      "Personalized AI interpretation temporarily unavailable.",
    );
  }
}

function fail(status: number, code: string, message: string): Response {
  return Response.json(
    {
      success: false,
      data: null,
      error: { code, message },
      meta: { requestId: "multi-scan-decision" },
    },
    { status },
  );
}
