import { apiUrl } from "@/lib/network/api-url";
import { getFoodGuardAuthHeaders } from "@/services/gamification.service";
import type {
  AchievementFilter,
  AchievementsResponse,
  ChallengeListResponse,
  ClaimRewardResponse,
  GamificationActivityResponse,
  GamificationOverview,
  RewardListResponse,
  StreakProtectionHistoryResponse,
  StreakProtectionStatus,
} from "./types";

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T | null;
  error?: { code?: string; message?: string } | null;
};

/**
 * A failed gamification request, carrying the HTTP status and the backend's
 * error code so the UI can tell "not signed in" (401) from "server problem".
 */
export class GamificationApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "GamificationApiError";
    this.status = status;
    this.code = code;
  }

  /** True when the request failed because there is no usable session. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** True for failures a retry could plausibly resolve. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

async function readEnvelope<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.success || payload.data == null) {
    throw new GamificationApiError(
      payload?.error?.message ?? fallbackMessage,
      response.status,
      payload?.error?.code ?? null,
    );
  }
  return payload.data;
}

async function get<T>(path: string, signal: AbortSignal | undefined, fallbackMessage: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      headers: getFoodGuardAuthHeaders(),
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new GamificationApiError(
      error instanceof Error && error.message ? error.message : fallbackMessage,
      0,
      null,
    );
  }
  return readEnvelope<T>(response, fallbackMessage);
}

export type GamificationApi = {
  getOverview(signal?: AbortSignal): Promise<GamificationOverview>;
  getAchievements(filter: AchievementFilter, signal?: AbortSignal): Promise<AchievementsResponse>;
  getRewards(signal?: AbortSignal): Promise<RewardListResponse>;
  getRewardHistory(signal?: AbortSignal): Promise<RewardListResponse>;
  getStreakProtection(signal?: AbortSignal): Promise<StreakProtectionStatus>;
  getStreakProtectionHistory(signal?: AbortSignal): Promise<StreakProtectionHistoryResponse>;
  getChallenges(signal?: AbortSignal): Promise<ChallengeListResponse>;
  claimReward(rewardId?: string, userRewardId?: string): Promise<ClaimRewardResponse>;
};

/**
 * Typed client for the live gamification endpoints. There are no fixtures and
 * no fallbacks here: a failed request surfaces as a `GamificationApiError` so
 * the caller can render an honest error state instead of invented numbers.
 */
export const gamificationApi: GamificationApi = {
  getOverview: (signal) =>
    get<GamificationOverview>(
      "/api/gamification/overview",
      signal,
      "Unable to load your FoodGuard progress",
    ),

  getAchievements: (filter, signal) =>
    get<AchievementsResponse>(
      `/api/gamification/achievements?filter=${filter}`,
      signal,
      "Unable to load your achievements",
    ),

  getRewards: (signal) =>
    get<RewardListResponse>("/api/gamification/rewards", signal, "Unable to load rewards"),

  getRewardHistory: (signal) =>
    get<RewardListResponse>(
      "/api/gamification/rewards/history",
      signal,
      "Unable to load reward history",
    ),

  getStreakProtection: (signal) =>
    get<StreakProtectionStatus>(
      "/api/gamification/streak-protection",
      signal,
      "Unable to load streak protection",
    ),

  getStreakProtectionHistory: (signal) =>
    get<StreakProtectionHistoryResponse>(
      "/api/gamification/streak-protection/history",
      signal,
      "Unable to load protection history",
    ),

  getChallenges: (signal) =>
    get<ChallengeListResponse>(
      "/api/gamification/challenges",
      signal,
      "Unable to load your challenges",
    ),

  /**
   * Names the reward only. Eligibility is re-derived inside the backend
   * transaction, so the client never asserts that a reward was earned.
   */
  async claimReward(rewardId, userRewardId) {
    let response: Response;
    try {
      response = await fetch(apiUrl("/api/gamification/rewards/claim"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getFoodGuardAuthHeaders(),
        },
        body: JSON.stringify({
          ...(rewardId ? { reward_id: rewardId } : {}),
          ...(userRewardId ? { user_reward_id: userRewardId } : {}),
        }),
      });
    } catch (error) {
      throw new GamificationApiError(
        error instanceof Error && error.message ? error.message : "Unable to claim this reward",
        0,
        null,
      );
    }
    return readEnvelope<ClaimRewardResponse>(response, "Unable to claim this reward");
  },
};

export type { GamificationActivityResponse };
