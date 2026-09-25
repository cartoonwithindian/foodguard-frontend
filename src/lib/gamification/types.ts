/**
 * Wire contracts for the FoodGuard gamification API.
 *
 * These mirror the backend responses exactly (verified against the live
 * routes in `foodguard-backend/src/app/api/gamification/**`). Nothing here is
 * computed client-side: the backend owns the level curve, achievement rules,
 * streak math and reward eligibility, and every field below is rendered as-is.
 */

/** `GET /api/gamification/achievements?filter=` values the backend accepts. */
export type AchievementFilter = "all" | "unlocked" | "locked";

/** Derived server-side from lifetime XP. The client never recomputes it. */
export type LevelView = {
  level: number;
  total_xp: number;
  level_xp: number;
  next_level_xp: number | null;
  current_level_xp: number;
  xp_to_next_level: number;
  progress: number;
  is_max_level: boolean;
};

/** Present only when a read crossed a level boundary. */
export type LevelUpEvent = {
  from_level: number;
  to_level: number;
  total_xp: number;
};

/** One achievement plus this user's real, server-observed progress. */
export type AchievementView = {
  achievement_id: string;
  name: string;
  description: string;
  icon: string;
  condition_type: string;
  target: number;
  progress: number;
  progress_ratio: number;
  reward_xp: number;
  unlocked: boolean;
  unlocked_at: string | null;
};

/**
 * A configured achievement, so progress can be labelled without hardcoding
 * names or reward amounts in the client.
 */
export type AchievementCatalogueEntry = {
  achievement_id: string;
  name: string;
  description: string;
  icon: string;
  target: number;
  reward_xp: number;
};

export type AchievementsResponse = {
  level: LevelView;
  achievements: AchievementView[];
  unlocked: number;
  total: number;
  filter: AchievementFilter;
  catalogue: AchievementCatalogueEntry[];
  leveled_up: boolean;
  level_up: LevelUpEvent | null;
  newly_unlocked: string[];
};

/** `GET /api/gamification/overview` */
export type GamificationOverview = {
  total_xp: number;
  level: LevelView;
  current_streak: number;
  longest_streak: number;
  achievements: {
    unlocked: number;
    total: number;
  };
  challenges: {
    daily_completed: number;
    daily_total: number;
    weekly_completed: number;
    weekly_total: number;
  };
  streak_protection: {
    available_count: number;
    max_available: number;
    used_count: number;
  };
  rewards: {
    available: number;
    earned: number;
  };
};

export type RewardType = "STREAK_PROTECTION" | "XP_BONUS";

/** A configured reward plus this user's real, server-derived eligibility. */
export type RewardView = {
  user_reward_id: string | null;
  reward_id: string;
  name: string;
  description: string;
  reward_type: RewardType | string;
  condition_type: string;
  target: number;
  progress: number;
  eligible: boolean;
  earned: boolean;
  claimed: boolean;
  claimed_at: string | null;
  earned_at: string | null;
  reward_value: number;
  requires_claim: boolean;
};

/** `GET /api/gamification/rewards` and `GET /api/gamification/rewards/history` */
export type RewardListResponse = {
  rewards: RewardView[];
  available: number;
  earned: number;
  claimed: number;
};

export type ClaimRewardResponse = {
  reward: RewardView;
  claimed: boolean;
  alreadyClaimed: boolean;
};

/** `GET /api/gamification/streak-protection` */
export type StreakProtectionStatus = {
  available_count: number;
  used_count: number;
  max_available: number;
  current_streak: number;
  last_protected: {
    protected_date: string;
    used_at: string;
    reason: string;
  } | null;
};

export type StreakProtectionUsage = {
  protected_date: string;
  streak_before: number;
  streak_after: number;
  used_at: string;
  reason: string;
};

/** `GET /api/gamification/streak-protection/history` */
export type StreakProtectionHistoryResponse = {
  history: StreakProtectionUsage[];
};

/**
 * The protection figures both the overview and the dedicated endpoint report.
 * `StreakProtectionStatus` satisfies this, and so does
 * `overview.streak_protection` -- which simply omits `last_protected`.
 */
export type StreakProtectionSummary = {
  available_count: number;
  max_available: number;
  used_count: number;
  last_protected?: StreakProtectionStatus["last_protected"];
};

/**
 * Condition types the backend can evaluate for a challenge
 * (`CHALLENGE_CONDITION_TYPES` in the backend's challenge config). The union is
 * here so a challenge can be handed to the shared `ChallengeCard` without a cast;
 * `conditionLabel()` still degrades gracefully if the backend adds one.
 */
export type ChallengeConditionType =
  | "UNIQUE_PRODUCT_COUNT"
  | "PRODUCT_SCAN_COUNT"
  | "INGREDIENT_VIEW_COUNT"
  | "MEANINGFUL_CHAT_COUNT"
  | "STREAK_DAYS";

export type ChallengeType = "DAILY" | "WEEKLY";

/** `GET /api/gamification/challenges` */
export type ChallengeView = {
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

export type ChallengeHistoryView = ChallengeView & {
  status: "active" | "completed" | "expired";
  completed_at: string | null;
};

export type ChallengeListResponse = {
  daily: ChallengeView[];
  weekly: ChallengeView[];
  history: ChallengeHistoryView[];
};

/**
 * `POST /api/gamification/activity` and `/activity/ingredient-view`.
 *
 * `level`, `level_up` and `newly_unlocked` are optional because the backend only
 * includes them when its reconciliation actually crossed a boundary. The UI
 * surfaces them when present and stays silent when absent -- it never infers
 * them.
 */
export type GamificationActivityResponse = {
  xp_awarded: number;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  activity_date: string;
  idempotent: boolean;
  completed_challenges: Array<{
    challenge_id: string;
    name: string;
    description: string;
    xp_reward: number;
  }>;
  level?: LevelView;
  level_up?: LevelUpEvent | null;
  newly_unlocked?: AchievementView[] | string[];
};
