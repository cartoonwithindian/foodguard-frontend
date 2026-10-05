import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sendChatMessage,
  fetchChatHistory,
  ChatClientError,
} from "@/lib/chat-client";

function mockFetchOnce(status: number, payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

function mockToken(token: string | null) {
  const store: Record<string, string> = token ? { "foodgaurd-token": token } : {};
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: () => {},
    removeItem: () => {},
  });
}

beforeEach(() => {
  mockToken("test-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendChatMessage", () => {
  it("shapes a successful response", async () => {
    mockFetchOnce(200, {
      success: true,
      data: {
        answer: "This product is low concern.",
        sources: [{ title: "Labelling Requirements", source: "FSSAI", url: "https://fssai.gov.in" }],
        actions: [{ type: "view_analysis", label: "View analysis", payload: { product_id: "p1" } }],
        conversation_id: "conv-1",
        metadata: { intent: "PRODUCT_EXPLANATION", model_version: "foodguard-chat-v2" },
      },
      error: null,
      meta: null,
    });

    const result = await sendChatMessage({ message: "why", productId: "p1" });
    expect(result.answer).toContain("low concern");
    expect(result.conversation_id).toBe("conv-1");
    expect(result.sources[0].source).toBe("FSSAI");
    expect(result.actions[0].type).toBe("view_analysis");
    expect(result.metadata.model_version).toBe("foodguard-chat-v2");
  });

  it("sends product_id and conversation_id in the body", async () => {
    let body: unknown = null;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({ success: true, data: { answer: "ok", sources: [], actions: [], conversation_id: "conv-9", metadata: {} } }),
          { status: 200 },
        );
      }),
    );
    await sendChatMessage({ message: "hello", productId: "p42", conversationId: "conv-9" });
    expect(body).toMatchObject({ message: "hello", product_id: "p42", conversation_id: "conv-9" });
  });

  it("maps 401 to unauthorized", async () => {
    mockFetchOnce(401, { success: false, error: null, data: null });
    await expect(sendChatMessage({ message: "hi" })).rejects.toMatchObject({
      kind: "unauthorized",
    });
  });

  it("maps 429 to rate_limited", async () => {
    mockFetchOnce(429, { success: false, error: null, data: null });
    const err: ChatClientError = await sendChatMessage({ message: "hi" }).then(
      () => { throw new Error("expected failure"); },
      (e: unknown) => e as ChatClientError,
    );
    expect(err.kind).toBe("rate_limited");
    expect(err.message).toContain("too quickly");
  });

  it("maps 5xx to the friendly unavailable message", async () => {
    mockFetchOnce(503, { success: false, error: null, data: null });
    const err: ChatClientError = await sendChatMessage({ message: "hi" }).then(
      () => { throw new Error("expected failure"); },
      (e: unknown) => e as ChatClientError,
    );
    expect(err.kind).toBe("unavailable");
    expect(err.message).toContain("temporarily unavailable");
  });

  it("maps network failures to unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    const err: ChatClientError = await sendChatMessage({ message: "hi" }).then(
      () => { throw new Error("expected failure"); },
      (e: unknown) => e as ChatClientError,
    );
    expect(err.kind).toBe("unavailable");
  });

  it("times out after the request budget", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init.signal as AbortSignal;
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
      ),
    );
    const promise = sendChatMessage({ message: "hi" }).then(
      () => { throw new Error("expected failure"); },
      (e: unknown) => e as ChatClientError,
    );
    await vi.advanceTimersByTimeAsync(50_000);
    const err = await promise;
    expect(err.kind).toBe("unavailable");
    expect(err.message).toContain("too long");
    vi.useRealTimers();
  });
});

describe("fetchChatHistory", () => {
  it("returns messages for the conversation", async () => {
    mockFetchOnce(200, {
      success: true,
      data: {
        conversation_id: "conv-1",
        messages: [
          { id: "m1", role: "user", content: "hi", createdAt: "2026-01-01T00:00:00Z" },
          { id: "m2", role: "assistant", content: "hello", createdAt: "2026-01-01T00:00:01Z" },
        ],
      },
      error: null,
      meta: null,
    });
    const history = await fetchChatHistory("conv-1");
    expect(history.conversation_id).toBe("conv-1");
    expect(history.messages).toHaveLength(2);
    expect(history.messages[1].role).toBe("assistant");
  });

  it("requests with the conversation_id query param", async () => {
    let url = "";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (u: string) => {
        url = String(u);
        return new Response(JSON.stringify({ success: true, data: { conversation_id: "conv-x", messages: [] } }), { status: 200 });
      }),
    );
    await fetchChatHistory("conv-x");
    expect(url).toContain("conversation_id=conv-x");
  });
});

/**
 * Split-deployment regression.
 *
 * `apiUrl()` resolves `NEXT_PUBLIC_API_URL` once at module load, so each case
 * resets the module registry and re-imports the client. Without this the chat
 * client kept requesting a relative `/api/chat`, which the deployed frontend
 * answered with its own 404 (or a store-backed 500) instead of the backend's
 * working endpoint.
 */
describe("split-origin deployment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadClientWithBase(base: string | undefined) {
    if (base === undefined) {
      vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    } else {
      vi.stubEnv("NEXT_PUBLIC_API_URL", base);
    }
    vi.resetModules();
    return import("@/lib/chat-client");
  }

  function captureUrl(payload: unknown) {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (u: string) => {
        seen.push(String(u));
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    return seen;
  }

  const SEND_OK = {
    success: true,
    data: {
      answer: "ok",
      sources: [],
      actions: [],
      conversation_id: "conv-1",
      metadata: { intent: "PRODUCT_EXPLANATION", model_version: "v2" },
    },
  };

  const HISTORY_OK = { success: true, data: { conversation_id: "conv-1", messages: [] } };

  it("sends chat to the backend origin when NEXT_PUBLIC_API_URL is set", async () => {
    const { sendChatMessage } = await loadClientWithBase("https://backend.example.onrender.com");
    const urls = captureUrl(SEND_OK);

    await sendChatMessage({ message: "hi" });

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://backend.example.onrender.com/api/chat");
  });

  it("reads chat history from the backend origin", async () => {
    const { fetchChatHistory } = await loadClientWithBase("https://backend.example.onrender.com");
    const urls = captureUrl(HISTORY_OK);

    await fetchChatHistory("conv-1");

    expect(urls[0]).toBe(
      "https://backend.example.onrender.com/api/chat?conversation_id=conv-1",
    );
  });

  it("keeps requests same-origin when the variable is unset (local dev)", async () => {
    const { sendChatMessage, fetchChatHistory } = await loadClientWithBase(undefined);
    const urls = captureUrl(SEND_OK);

    await sendChatMessage({ message: "hi" });
    expect(urls[0]).toBe("/api/chat");

    const historyUrls = captureUrl(HISTORY_OK);
    await fetchChatHistory("conv-2");
    expect(historyUrls[0]).toBe("/api/chat?conversation_id=conv-2");
  });

  it("does not emit a double slash when the base has a trailing slash", async () => {
    const { sendChatMessage } = await loadClientWithBase(
      "https://backend.example.onrender.com/",
    );
    const urls = captureUrl(SEND_OK);

    await sendChatMessage({ message: "hi" });

    expect(urls[0]).toBe("https://backend.example.onrender.com/api/chat");
    expect(urls[0]).not.toContain(".com//api");
  });

  it("still forwards the Authorization header to the cross-origin backend", async () => {
    const { sendChatMessage } = await loadClientWithBase("https://backend.example.onrender.com");
    // `getToken()` returns null unless `window` exists, and this suite runs in
    // the node environment, so the browser global has to be stubbed explicitly.
    const tokens: Record<string, string> = { "foodgaurd-token": "split-token" };
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => tokens[k] ?? null,
        setItem: () => {},
        removeItem: () => {},
      },
    });
    let auth: unknown = null;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_u: string, init: RequestInit) => {
        auth = (init.headers as Record<string, string>).Authorization;
        return new Response(JSON.stringify(SEND_OK), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    await sendChatMessage({ message: "hi" });

    expect(auth).toBe("Bearer split-token");
  });
});
