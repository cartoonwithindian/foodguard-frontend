/**
 * Phase 5 — JEVAdapter (client side).
 *
 * Step 6: the UI must never call a model. The architecture is
 *
 *   PersonalDecisionEngine → JEVAdapter → /api/multi-scan/decision → JEV
 *
 * so this module is the single seam. Swapping Qwen for a local model later
 * means implementing `JEVAdapter`, not touching the engine or the UI.
 *
 * Every failure mode — network, HTTP error, malformed body, timeout — is
 * reported as `ok: false` rather than thrown, because the engine's contract
 * is to keep showing deterministic evidence when JEV is down (Step 18).
 */
import { withTimeout } from "@/lib/multi-scan/with-timeout";
import type { JEVInput, JEVOutput } from "./jev-contract";

/** JEV should be fast. A slow interpretation is not worth blocking the UI. */
export const JEV_TIMEOUT_MS = 15_000;

export type JEVFailureCode =
  | "jev_unavailable"
  | "jev_timeout"
  | "jev_error"
  | "invalid_jev_response";

export type JEVResult =
  | { ok: true; interpretation: JEVOutput; source: "qwen" | "mock" }
  | { ok: false; code: JEVFailureCode; message: string };

export interface JEVAdapter {
  interpret(input: JEVInput): Promise<JEVResult>;
}

export type HttpJEVAdapterOptions = {
  url?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

/** Adapter that calls the app's own server route. */
export class HttpJEVAdapter implements JEVAdapter {
  private readonly url: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpJEVAdapterOptions = {}) {
    this.url = options.url ?? "/api/multi-scan/decision";
    this.timeoutMs = options.timeoutMs ?? JEV_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async interpret(input: JEVInput): Promise<JEVResult> {
    let response: Response;
    try {
      response = await withTimeout(
        this.fetchImpl(this.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Exactly the allowlist payload — no user identifiers ride along.
          body: JSON.stringify(input),
        }),
        this.timeoutMs,
        "jev_timeout",
      );
    } catch (err) {
      const code: JEVFailureCode =
        err instanceof Error && err.message === "jev_timeout" ? "jev_timeout" : "jev_error";
      return {
        ok: false,
        code,
        message: "Personalized AI interpretation temporarily unavailable.",
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        code: "jev_unavailable",
        message: "Personalized AI interpretation temporarily unavailable.",
      };
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return {
        ok: false,
        code: "invalid_jev_response",
        message: "Personalized AI interpretation temporarily unavailable.",
      };
    }

    const payload = json as {
      success?: boolean;
      data?: { interpretation?: unknown; source?: string };
    };
    if (!payload.success || !payload.data?.interpretation) {
      return {
        ok: false,
        code: "invalid_jev_response",
        message: "Personalized AI interpretation temporarily unavailable.",
      };
    }

    // The route already validated this; re-checking here keeps the engine
    // safe even if a different adapter is injected (e.g. in tests).
    const interpretation = payload.data.interpretation as JEVOutput;
    if (typeof interpretation.explanation !== "string" || !interpretation.explanation.trim()) {
      return {
        ok: false,
        code: "invalid_jev_response",
        message: "Personalized AI interpretation temporarily unavailable.",
      };
    }

    return {
      ok: true,
      interpretation,
      source: payload.data.source === "qwen" ? "qwen" : "mock",
    };
  }
}

let shared: JEVAdapter | null = null;

export function getJEVAdapter(): JEVAdapter {
  if (!shared) shared = new HttpJEVAdapter();
  return shared;
}

export function setJEVAdapterForTesting(adapter: JEVAdapter | null): void {
  shared = adapter;
}
