import type {
  AchievementView,
  AchievementsResponse,
  ChallengeListResponse,
  ClaimRewardResponse,
  GamificationActivityResponse,
  GamificationOverview,
  LevelView,
  RewardListResponse,
  RewardView,
  StreakProtectionHistoryResponse,
  StreakProtectionStatus,
} from "@/lib/gamification/types";

/**
 * Test fixtures for the gamification client tests.
 *
 * These mirror responses recorded from the live backend
 * (`GET /api/gamification/**`) so the client's parsing, state and de-duplication
 * can be exercised without inventing numbers. They are test-only: nothing in
 * `src/lib` or `src/components` imports this file, and no fixture ever reaches
 * the UI.
 */

export function levelView(overrides: Partial<LevelView> = {}): LevelView {
  return {
    level: 1,
    total_xp: 0,
    level_xp: 0,
    next_level_xp: 100,
    current_level_xp: 0,
    xp_to_next_level: 100,
    progress: 0,
    is_max_level: false,
    ...overrides,
  };
}

export function achievementView(overrides: Partial<AchievementView> = {}): AchievementView {
  return {
    achievement_id: "first_scan",
    name: "First Look",
    description: "Scan your first food product",
    icon: "🔍",
    condition_type: "UNIQUE_PRODUCTS_SCANNED",
    target: 1,
    progress: 0,
    progress_ratio: 0,
    reward_xp: 10,
    unlocked: false,
    unlocked_at: null,
    ...overrides,
  };
}

export function achievementsResponse(
  overrides: Partial<AchievementsResponse> = {},
): AchievementsResponse {
  return {
    level: levelView(),
    achievements: [achievementView()],
    unlocked: 0,
    total: 8,
    filter: "all",
    catalogue: [
      {
        achievement_id: "first_scan",
        name: "First Look",
        description: "Scan your first food product",
        icon: "🔍",
        target: 1,
        reward_xp: 10,
      },
    ],
    leveled_up: false,
    level_up: null,
    newly_unlocked: [],
    ...overrides,
  };
}

export function overviewResponse(overrides: Partial<GamificationOverview> = {}): GamificationOverview {
  return {
    total_xp: 0,
    level: levelView(),
    current_streak: 0,
    longest_streak: 0,
    achievements: { unlocked: 0, total: 8 },
    challenges: { daily_completed: 0, daily_total: 3, weekly_completed: 0, weekly_total: 3 },
    streak_protection: { available_count: 0, max_available: 1, used_count: 0 },
    rewards: { available: 0, earned: 0 },
    ...overrides,
  };
}

export function rewardView(overrides: Partial<RewardView> = {}): RewardView {
  return {
    user_reward_id: null,
    reward_id: "seven_day_streak_guardian",
    name: "Streak Guardian",
    description: "Keep a 7-day FoodGuard streak to earn a streak protection",
    reward_type: "STREAK_PROTECTION",
    condition_type: "STREAK_DAYS",
    target: 7,
    progress: 0,
    eligible: false,
    earned: false,
    claimed: false,
    claimed_at: null,
    earned_at: null,
    reward_value: 1,
    requires_claim: false,
    ...overrides,
  };
}

export function rewardsResponse(overrides: Partial<RewardListResponse> = {}): RewardListResponse {
  return { rewards: [rewardView()], available: 0, earned: 0, claimed: 0, ...overrides };
}

export function claimResponse(overrides: Partial<ClaimRewardResponse> = {}): ClaimRewardResponse {
  return {
    reward: rewardView({ claimed: true, claimed_at: "2026-09-25T10:00:00.000Z" }),
    claimed: true,
    alreadyClaimed: false,
    ...overrides,
  };
}

export function protectionStatus(
  overrides: Partial<StreakProtectionStatus> = {},
): StreakProtectionStatus {
  return {
    available_count: 0,
    used_count: 0,
    max_available: 1,
    current_streak: 0,
    last_protected: null,
    ...overrides,
  };
}

export function protectionHistory(
  overrides: Partial<StreakProtectionHistoryResponse> = {},
): StreakProtectionHistoryResponse {
  return { history: [], ...overrides };
}

export function challengesResponse(
  overrides: Partial<ChallengeListResponse> = {},
): ChallengeListResponse {
  return {
    daily: [
      {
        challenge_id: "daily_product_explorer",
        name: "Product Explorer",
        description: "Scan 3 different food products",
        challenge_type: "DAILY",
        condition_type: "UNIQUE_PRODUCT_COUNT",
        progress: 0,
        target: 3,
        xp_reward: 25,
        completed: false,
        reward_claimed: false,
        period_start: "2026-09-25",
        period_end: "2026-09-26",
      },
    ],
    weekly: [],
    history: [],
    ...overrides,
  };
}

export function activityResponse(
  overrides: Partial<GamificationActivityResponse> = {},
): GamificationActivityResponse {
  return {
    xp_awarded: 25,
    total_xp: 25,
    current_streak: 1,
    longest_streak: 1,
    activity_date: "2026-09-25",
    idempotent: false,
    completed_challenges: [],
    ...overrides,
  };
}

export type StubApi = {
  getOverview: () => Promise<GamificationOverview>;
  getAchievements: (filter: string) => Promise<AchievementsResponse>;
  getRewards: () => Promise<RewardListResponse>;
  getRewardHistory: () => Promise<RewardListResponse>;
  getStreakProtection: () => Promise<StreakProtectionStatus>;
  getStreakProtectionHistory: () => Promise<StreakProtectionHistoryResponse>;
  getChallenges: () => Promise<ChallengeListResponse>;
  claimReward: () => Promise<ClaimRewardResponse>;
  calls: string[];
};

export type StubApiOptions = {
  achievements?: (filter: string) => AchievementsResponse;
  overview?: () => GamificationOverview;
  rewards?: () => RewardListResponse;
  rewardHistory?: () => RewardListResponse;
  protection?: () => StreakProtectionStatus;
  protectionHistory?: () => StreakProtectionHistoryResponse;
  challenges?: () => ChallengeListResponse;
  claim?: () => ClaimRewardResponse;
};

/** A minimal `GamificationApi` double that records which endpoints were hit. */
export function stubApi(options: StubApiOptions = {}): StubApi {
  const calls: string[] = [];
  return {
    calls,
    getOverview: async () => {
      calls.push("overview");
      return (options.overview ?? overviewResponse)();
    },
    getAchievements: async (filter: string) => {
      calls.push(`achievements:${filter}`);
      return (options.achievements ?? ((f: string) => achievementsResponse({ filter: f as "all" })))(
        filter,
      );
    },
    getRewards: async () => {
      calls.push("rewards");
      return (options.rewards ?? rewardsResponse)();
    },
    getRewardHistory: async () => {
      calls.push("rewardHistory");
      return (options.rewardHistory ?? rewardsResponse)();
    },
    getStreakProtection: async () => {
      calls.push("protection");
      return (options.protection ?? protectionStatus)();
    },
    getStreakProtectionHistory: async () => {
      calls.push("protectionHistory");
      return (options.protectionHistory ?? protectionHistory)();
    },
    getChallenges: async () => {
      calls.push("challenges");
      return (options.challenges ?? challengesResponse)();
    },
    claimReward: async () => {
      calls.push("claim");
      return (options.claim ?? claimResponse)();
    },
  };
}
