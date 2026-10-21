/**
 * Multi-Product Scanner — food-understanding client (Phase 4).
 *
 * The LLM API key lives server-side, so the browser calls the thin Next
 * route `/api/multi-scan/understanding`, which wraps the existing
 * AIProvider (`explainFoodProfile`). Never throws — returns a typed
 * result so the UI can degrade to raw product data.
 */
"use client";

import type { FoodProfileUnderstanding, FoodProfileUnderstandingInput } from "@/lib/ai";

export type UnderstandingSuccess = {
  ok: true;
  understanding: FoodProfileUnderstanding;
  /** Honest attribution: real model vs deterministic fallback. */
  source: "qwen" | "mock";
};

export type UnderstandingFailure = {
  ok: false;
  code: "QWEN_ERROR" | "INVALID_QWEN_RESPONSE" | "UNDERSTANDING_UNAVAILABLE";
  message: string;
};

export type UnderstandingResult = UnderstandingSuccess | UnderstandingFailure;

const UNDERSTANDING_TIMEOUT_MS = 60_000;

export async function fetchFoodUnderstanding(
  input: FoodProfileUnderstandingInput,
): Promise<UnderstandingResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UNDERSTANDING_TIMEOUT_MS);
    try {
      const res = await fetch("/api/multi-scan/understanding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      const payload = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { understanding?: FoodProfileUnderstanding; source?: "qwen" | "mock" };
        error?: { code?: string; message?: string };
      } | null;
      if (!res.ok || !payload?.success || !payload.data?.understanding) {
        const code = payload?.error?.code;
        return {
          ok: false,
          code:
            code === "INVALID_QWEN_RESPONSE" ? "INVALID_QWEN_RESPONSE"
            : code === "QWEN_UNAVAILABLE" ? "UNDERSTANDING_UNAVAILABLE"
            : "QWEN_ERROR",
          message: payload?.error?.message || "AI ingredient interpretation unavailable.",
        };
      }
      return {
        ok: true,
        understanding: payload.data.understanding,
        source: payload.data.source ?? "mock",
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return {
      ok: false,
      code: "QWEN_ERROR",
      message: "AI ingredient interpretation unavailable.",
    };
  }
}
