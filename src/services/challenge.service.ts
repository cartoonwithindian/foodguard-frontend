import { apiUrl } from "@/lib/network/api-url";
import { getFoodGuardAuthHeaders, publishGamificationUpdate } from "./gamification.service";

export const CHALLENGES_UPDATED_EVENT = "foodguard:challenges-updated";

export type ChallengeConditionType =
  | "UNIQUE_PRODUCT_COUNT"
  | "PRODUCT_SCAN_COUNT"
  | "INGREDIENT_VIEW_COUNT"
  | "MEANINGFUL_CHAT_COUNT"
  | "STREAK_DAYS";

export type ChallengeType = "DAILY" | "WEEKLY";

export type UserChallenge = {
  challenge_id: string;
  name: string;
  description: string;
  challenge_type: ChallengeType;
  condition_type: ChallengeConditionType;
  progress: number;
  target: number;
  xp_reward: number;
  completed: boolean;
  reward_claimed: boolean;
  period_start: string;
  period_end: string;
};

export type ChallengeHistoryItem = UserChallenge & {
  status: "active" | "completed" | "expired";
  completed_at: string | null;
};

export type ChallengeResponse = {
  daily: UserChallenge[];
  weekly: UserChallenge[];
  history: ChallengeHistoryItem[];
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string } | null;
};

async function readChallengeResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error?.message ?? "Unable to load FoodGuard challenges");
  }
  return payload.data;
}

export async function fetchChallenges(signal?: AbortSignal): Promise<ChallengeResponse> {
  const response = await fetch(apiUrl("/api/gamification/challenges"), {
    headers: getFoodGuardAuthHeaders(),
    cache: "no-store",
    signal,
  });
  return readChallengeResponse<ChallengeResponse>(response);
}

export function publishChallengesUpdate(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHALLENGES_UPDATED_EVENT));
}

export type ChallengeCompletion = {
  challenge_id: string;
  name: string;
  description: string;
  xp_reward: number;
};

export type IngredientViewActivityResult = {
  xp_awarded: number;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  activity_date: string;
  idempotent: boolean;
  completed_challenges: ChallengeCompletion[];
};

/**
 * Records a real ingredient-information view. The backend validates the
 * product and the event id; the client cannot set progress or completion.
 */
export async function submitIngredientViewActivity(
  productId: string,
  eventId: string,
): Promise<IngredientViewActivityResult> {
  const response = await fetch(apiUrl("/api/gamification/activity/ingredient-view"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getFoodGuardAuthHeaders(),
    },
    body: JSON.stringify({
      product_id: productId,
      event_id: eventId,
    }),
  });
  const result = await readChallengeResponse<IngredientViewActivityResult>(response);
  publishGamificationUpdate({
    total_xp: result.total_xp,
    current_streak: result.current_streak,
    longest_streak: result.longest_streak,
    last_activity_date: result.activity_date,
  });
  if (result.completed_challenges.length > 0) publishChallengesUpdate();
  return result;
}
