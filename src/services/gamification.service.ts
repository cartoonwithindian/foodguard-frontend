import { apiUrl } from "@/lib/network/api-url";

const TOKEN_KEY = "foodgaurd-token";
export const GAMIFICATION_UPDATED_EVENT = "foodguard:gamification-updated";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string } | null;
};

export type GamificationProfile = {
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
};

export type GamificationActivityResult = {
  xp_awarded: number;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  activity_date: string;
  idempotent: boolean;
  completed_challenges?: Array<{
    challenge_id: string;
    name: string;
    description: string;
    xp_reward: number;
  }>;
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getFoodGuardAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getLocalTimezone(): string | undefined {
  if (typeof Intl === "undefined") return undefined;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

let scanEventSequence = 0;

export function createScanEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // This is an idempotency identifier, not a reward value or user identifier.
  scanEventSequence += 1;
  return `scan-${Date.now()}-${scanEventSequence}`;
}

export function publishGamificationUpdate(profile: GamificationProfile): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<GamificationProfile>(GAMIFICATION_UPDATED_EVENT, { detail: profile }),
  );
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error?.message ?? "FoodGuard progress request failed");
  }
  return payload.data;
}

export async function fetchGamificationProfile(signal?: AbortSignal): Promise<GamificationProfile> {
  const response = await fetch(apiUrl("/api/gamification/profile"), {
    headers: getFoodGuardAuthHeaders(),
    cache: "no-store",
    signal,
  });
  return readEnvelope<GamificationProfile>(response);
}
