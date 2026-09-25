import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GamificationApiError, gamificationApi } from "@/lib/gamification/api";

type FetchCall = { url: string; init: RequestInit | undefined };

function envelope(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => ({ success: ok, data, error: null, meta: { requestId: "test" } }),
  } as unknown as Response;
}

function failure(code: string, message: string, status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({ success: false, data: null, error: { code, message }, meta: null }),
  } as unknown as Response;
}

describe("gamification api client", () => {
  const calls: FetchCall[] = [];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    calls.length = 0;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockFetch(handler: (call: FetchCall) => Response): void {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = { url: String(input), init };
      calls.push(call);
      return handler(call);
    }) as unknown as typeof fetch;
  }

  it("unwraps the API envelope and requests the overview", async () => {
    mockFetch(() => envelope({ total_xp: 0, level: { level: 1 } }));

    const overview = await gamificationApi.getOverview();

    expect(calls[0].url).toContain("/api/gamification/overview");
    expect(overview).toEqual({ total_xp: 0, level: { level: 1 } });
  });

  it("sends the filter the caller asked for, never a hardcoded one", async () => {
    mockFetch(() => envelope({ filter: "locked", achievements: [] }));

    await gamificationApi.getAchievements("locked");

    expect(calls[0].url).toContain("/api/gamification/achievements?filter=locked");
  });

  it("passes the app's auth header through, so the request is authenticated", async () => {
    // The app keeps its JWT in `window.localStorage`; the client only has to
    // forward what `getFoodGuardAuthHeaders()` returns.
    const originalWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (key: string) => (key === "foodgaurd-token" ? "test-token" : null),
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    };
    try {
      mockFetch(() => envelope({}));
      await gamificationApi.getRewards();
      const headers = (calls[0].init?.headers ?? {}) as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer test-token");
    } finally {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });

  it("surfaces a 401 as an unauthorized error rather than a generic failure", async () => {
    mockFetch(() => failure("UNAUTHORIZED", "Authentication required", 401));

    await expect(gamificationApi.getOverview()).rejects.toMatchObject({
      name: "GamificationApiError",
      status: 401,
      isUnauthorized: true,
    });
  });

  it("keeps the backend message and code on the error", async () => {
    mockFetch(() => failure("REWARD_NOT_ELIGIBLE", "Reward is not eligible", 409));

    const error = await gamificationApi.claimReward("some_reward").catch((caught) => caught);

    expect(error).toBeInstanceOf(GamificationApiError);
    expect((error as GamificationApiError).code).toBe("REWARD_NOT_ELIGIBLE");
    expect((error as GamificationApiError).message).toBe("Reward is not eligible");
    expect((error as GamificationApiError).isRetryable).toBe(false);
  });

  it("names only the reward when claiming, never an eligibility claim", async () => {
    mockFetch(() => envelope({ reward: {}, claimed: true, alreadyClaimed: false }));

    await gamificationApi.claimReward("seven_day_streak_guardian");

    const body = JSON.parse(String(calls[0].init?.body));
    expect(body).toEqual({ reward_id: "seven_day_streak_guardian" });
  });

  it("reports a network failure as a retryable status-0 error", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const error = await gamificationApi.getChallenges().catch((caught) => caught);

    expect(error).toBeInstanceOf(GamificationApiError);
    expect((error as GamificationApiError).status).toBe(0);
    expect((error as GamificationApiError).isRetryable).toBe(true);
  });
});
