import { getAIProvider } from "@/lib/ai";
import { isAIReady } from "@/lib/config";

/**
 * POST /api/multi-scan/understanding
 *
 * Thin server wrapper around the existing AIProvider's structured food
 * understanding (`explainFoodProfile`). The browser cannot hold the model
 * API key, so this route executes provider-side while the scanner UI stays
 * purely presentational. Body = FoodProfileUnderstandingInput.
 */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let input: unknown = null;
  try {
    input = await request.json();
  } catch {
    return fail(400, "INVALID_REQUEST", "Request body must be JSON.");
  }

  if (!input || typeof input !== "object") {
    return fail(400, "INVALID_REQUEST", "Missing food profile input.");
  }

  try {
    const provider = getAIProvider();
    if (!provider.explainFoodProfile) {
      return fail(503, "QWEN_UNAVAILABLE", "AI ingredient interpretation unavailable.");
    }
    const understanding = await provider.explainFoodProfile(
      input as Parameters<NonNullable<typeof provider.explainFoodProfile>>[0],
    );
    return Response.json({
      success: true,
      data: {
        understanding,
        source: isAIReady() ? "qwen" : "mock",
      },
      error: null,
      meta: { requestId: "multi-scan-understanding" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const invalid = /invalid json/i.test(message);
    return fail(
      invalid ? 500 : 503,
      invalid ? "INVALID_QWEN_RESPONSE" : "QWEN_ERROR",
      "AI ingredient interpretation unavailable.",
    );
  }
}

function fail(status: number, code: string, message: string): Response {
  return Response.json(
    {
      success: false,
      data: null,
      error: { code, message },
      meta: { requestId: "multi-scan-understanding" },
    },
    { status },
  );
}
