import { GamificationApiError, gamificationApi, type GamificationApi } from "./api";
import {
  CelebrationLedger,
  achievementEventId,
  levelUpEventId,
  type GamificationCelebration,
} from "./celebrations";
import type {
  AchievementFilter,
  AchievementsResponse,
  AchievementView,
  ChallengeListResponse,
  GamificationActivityResponse,
  GamificationOverview,
  LevelUpEvent,
  RewardListResponse,
  RewardView,
  StreakProtectionHistoryResponse,
  StreakProtectionStatus,
} from "./types";

/** Every independently loadable piece of server state the UI renders. */
export type DataSlice =
  | "overview"
  | "achievementsAll"
  | "achievementsUnlocked"
  | "achievementsLocked"
  | "rewards"
  | "rewardHistory"
  | "protection"
  | "protectionHistory"
  | "challenges";

/** The slices a scan or any other recorded activity can invalidate. */
export const ACTIVITY_SLICES: readonly DataSlice[] = [
  "overview",
  "achievementsAll",
  "challenges",
  "rewards",
  "protection",
];

/** Loaded by every gamification screen on first paint. */
export const ALL_SLICES: readonly DataSlice[] = [
  "overview",
  "achievementsAll",
  "challenges",
  "rewards",
  "protection",
];

export const FILTERS: readonly AchievementFilter[] = ["all", "unlocked", "locked"];

export const FILTER_SLICES: Record<AchievementFilter, DataSlice> = {
  all: "achievementsAll",
  unlocked: "achievementsUnlocked",
  locked: "achievementsLocked",
};

export type SliceStatus = "idle" | "loading" | "loaded" | "error";

export type SliceState<T> = {
  status: SliceStatus;
  data: T | null;
  error: GamificationApiError | null;
  /** Bumped on every successful load, so an effect can key a refetch on it. */
  loadedAt: number;
};

export type ClaimState = "claiming" | "claimed" | "failed";

export type GamificationState = {
  overview: SliceState<GamificationOverview>;
  /** Keyed by filter, so switching tabs keeps each tab's own status. */
  achievements: Record<AchievementFilter, SliceState<AchievementsResponse>>;
  rewards: SliceState<RewardListResponse>;
  rewardHistory: SliceState<RewardListResponse>;
  protection: SliceState<StreakProtectionStatus>;
  protectionHistory: SliceState<StreakProtectionHistoryResponse>;
  challenges: SliceState<ChallengeListResponse>;
  claiming: Record<string, ClaimState>;
  claimError: GamificationApiError | null;
  /** Pending once-per-event celebrations, oldest first. */
  celebrations: GamificationCelebration[];
};

type AnySlice = SliceState<unknown>;

function idleSlice<T>(): SliceState<T> {
  return { status: "idle", data: null, error: null, loadedAt: 0 };
}

function initialState(): GamificationState {
  return {
    overview: idleSlice<GamificationOverview>(),
    achievements: {
      all: idleSlice<AchievementsResponse>(),
      unlocked: idleSlice<AchievementsResponse>(),
      locked: idleSlice<AchievementsResponse>(),
    },
    rewards: idleSlice<RewardListResponse>(),
    rewardHistory: idleSlice<RewardListResponse>(),
    protection: idleSlice<StreakProtectionStatus>(),
    protectionHistory: idleSlice<StreakProtectionHistoryResponse>(),
    challenges: idleSlice<ChallengeListResponse>(),
    claiming: {},
    claimError: null,
    celebrations: [],
  };
}

function toApiError(error: unknown, fallback: string): GamificationApiError {
  if (error instanceof GamificationApiError) return error;
  const message = error instanceof Error && error.message ? error.message : fallback;
  return new GamificationApiError(message, 0, null);
}

function isAbort(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError";
  }
  return error instanceof Error && error.name === "AbortError";
}

export type GamificationStoreOptions = {
  api?: GamificationApi;
  ledger?: CelebrationLedger;
};

/**
 * The single source of truth for gamification state.
 *
 * Components never fetch on their own: they read a slice, ask the store to
 * refresh, or submit a claim. The store owns request de-duplication (one
 * in-flight call per slice, shared by every caller), error bookkeeping, and the
 * once-per-event celebration ledger.
 *
 * No level, achievement, streak or reward value is ever derived here. Every
 * number on screen comes from a server response, and celebrations are built
 * only from the `level_up` / `newly_unlocked` fields the backend itself sent.
 */
export class GamificationStore {
  private readonly api: GamificationApi;
  private readonly ledger: CelebrationLedger;
  private state: GamificationState = initialState();
  private readonly listeners = new Set<() => void>();
  private readonly inflight = new Map<DataSlice, Promise<void>>();
  private readonly aborts = new Map<DataSlice, AbortController>();
  /** Slices whose refresh arrived while a request was already in flight. */
  private readonly stale = new Set<DataSlice>();

  constructor(options: GamificationStoreOptions = {}) {
    this.api = options.api ?? gamificationApi;
    this.ledger = options.ledger ?? new CelebrationLedger();
  }

  // ── subscription plumbing ────────────────────────────────────────────────

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): GamificationState => this.state;

  private setState(update: (previous: GamificationState) => GamificationState): void {
    const next = update(this.state);
    if (next === this.state) return;
    this.state = next;
    for (const listener of Array.from(this.listeners)) listener();
  }

  // ── slice access ─────────────────────────────────────────────────────────

  private readSlice(state: GamificationState, slice: DataSlice): AnySlice {
    switch (slice) {
      case "overview":
        return state.overview;
      case "achievementsAll":
        return state.achievements.all;
      case "achievementsUnlocked":
        return state.achievements.unlocked;
      case "achievementsLocked":
        return state.achievements.locked;
      case "rewards":
        return state.rewards;
      case "rewardHistory":
        return state.rewardHistory;
      case "protection":
        return state.protection;
      case "protectionHistory":
        return state.protectionHistory;
      case "challenges":
        return state.challenges;
    }
  }

  private writeSlice(state: GamificationState, slice: DataSlice, next: AnySlice): GamificationState {
    switch (slice) {
      case "overview":
        return { ...state, overview: next as SliceState<GamificationOverview> };
      case "achievementsAll":
        return { ...state, achievements: { ...state.achievements, all: next as SliceState<AchievementsResponse> } };
      case "achievementsUnlocked":
        return {
          ...state,
          achievements: { ...state.achievements, unlocked: next as SliceState<AchievementsResponse> },
        };
      case "achievementsLocked":
        return {
          ...state,
          achievements: { ...state.achievements, locked: next as SliceState<AchievementsResponse> },
        };
      case "rewards":
        return { ...state, rewards: next as SliceState<RewardListResponse> };
      case "rewardHistory":
        return { ...state, rewardHistory: next as SliceState<RewardListResponse> };
      case "protection":
        return { ...state, protection: next as SliceState<StreakProtectionStatus> };
      case "protectionHistory":
        return {
          ...state,
          protectionHistory: next as SliceState<StreakProtectionHistoryResponse>,
        };
      case "challenges":
        return { ...state, challenges: next as SliceState<ChallengeListResponse> };
    }
  }

  private patchSlice(slice: DataSlice, update: (previous: AnySlice) => AnySlice): void {
    this.setState((state) => {
      const previous = this.readSlice(state, slice);
      const next = update(previous);
      if (next === previous) return state;
      return this.writeSlice(state, slice, next);
    });
  }

  // ── loading ──────────────────────────────────────────────────────────────

  private fetchSlice(slice: DataSlice, signal: AbortSignal): Promise<unknown> {
    switch (slice) {
      case "overview":
        return this.api.getOverview(signal);
      case "achievementsAll":
        return this.api.getAchievements("all", signal);
      case "achievementsUnlocked":
        return this.api.getAchievements("unlocked", signal);
      case "achievementsLocked":
        return this.api.getAchievements("locked", signal);
      case "rewards":
        return this.api.getRewards(signal);
      case "rewardHistory":
        return this.api.getRewardHistory(signal);
      case "protection":
        return this.api.getStreakProtection(signal);
      case "protectionHistory":
        return this.api.getStreakProtectionHistory(signal);
      case "challenges":
        return this.api.getChallenges(signal);
    }
  }

  private statusOf(slice: DataSlice): SliceStatus {
    return this.readSlice(this.state, slice).status;
  }

  /**
   * Loads one slice. Concurrent calls for the same slice share the in-flight
   * request, so a re-render or a second mounted panel cannot double-fetch, and
   * a refresh never blanks out the real numbers already on screen.
   *
   * A forced load that lands on an in-flight request is not dropped: the slice
   * is marked stale and re-read as soon as the current request settles. That is
   * what makes a scan during the first page load still refresh.
   */
  load(slice: DataSlice, options: { force?: boolean } = {}): Promise<void> {
    const existing = this.inflight.get(slice);
    if (existing) {
      if (options.force) this.stale.add(slice);
      return existing;
    }

    const status = this.statusOf(slice);
    if (!options.force && (status === "loading" || status === "loaded")) {
      return Promise.resolve();
    }

    const controller = new AbortController();
    this.aborts.set(slice, controller);
    this.stale.delete(slice);
    this.patchSlice(slice, (previous) => ({ ...previous, status: "loading", error: null }));

    const task = (async () => {
      try {
        const data = await this.fetchSlice(slice, controller.signal);
        if (controller.signal.aborted) return;
        this.patchSlice(slice, (previous) => ({
          status: "loaded",
          data,
          error: null,
          loadedAt: previous.loadedAt + 1,
        }));
        if (slice === "achievementsAll") {
          this.ingestAchievementCelebrations(data as AchievementsResponse);
        }
      } catch (error) {
        if (controller.signal.aborted || isAbort(error)) return;
        const apiError = toApiError(error, "Unable to load FoodGuard progress");
        // A failed refresh over existing data degrades to a warning banner
        // rather than wiping real numbers off the screen.
        this.patchSlice(slice, (previous) => ({
          ...previous,
          status: previous.data ? "loaded" : "error",
          error: apiError,
        }));
      } finally {
        this.inflight.delete(slice);
        this.aborts.delete(slice);
      }
      if (this.stale.delete(slice)) {
        await this.load(slice, { force: true });
      }
    })();

    this.inflight.set(slice, task);
    return task;
  }

  /** Loads each slice that has no data yet. Safe to call on every mount. */
  ensureLoaded(slices: readonly DataSlice[]): Promise<void> {
    return Promise.all(slices.map((slice) => this.load(slice))).then(() => undefined);
  }

  /** Forces a reload of the given slices (all of them by default). */
  refresh(slices: readonly DataSlice[] = ALL_SLICES): Promise<void> {
    return Promise.all(slices.map((slice) => this.load(slice, { force: true }))).then(
      () => undefined,
    );
  }

  // ── celebrations ─────────────────────────────────────────────────────────

  /**
   * Admits the events the backend reported on a successful `all` achievements
   * load, once each.
   *
   * Only the unfiltered `all` response feeds the ledger. A filtered response
   * omits the achievement that just unlocked, so it could not be resolved into
   * a celebration, and letting filters drive it would make whether a user is
   * congratulated depend on which tab happens to be open.
   */
  private ingestAchievementCelebrations(response: AchievementsResponse | null): void {
    if (!response) return;
    const admitted: GamificationCelebration[] = [];

    const levelUp: LevelUpEvent | null = response.level_up ?? null;
    if (levelUp) {
      const celebration = this.ledger.admit({
        kind: "level-up",
        id: levelUpEventId(levelUp.from_level, levelUp.to_level, levelUp.total_xp),
        fromLevel: levelUp.from_level,
        toLevel: levelUp.to_level,
        totalXp: levelUp.total_xp,
        level: response.level ?? null,
      });
      if (celebration) admitted.push(celebration);
    }

    for (const achievementId of response.newly_unlocked ?? []) {
      const view = response.achievements.find((entry) => entry.achievement_id === achievementId);
      // An id with no resolvable view is skipped: the celebration is never
      // rendered from an id alone.
      if (!view) continue;
      const celebration = this.ledger.admit({
        kind: "achievement",
        id: achievementEventId(achievementId),
        achievement: view,
      });
      if (celebration) admitted.push(celebration);
    }

    this.enqueueCelebrations(admitted);
  }

  private enqueueCelebrations(admitted: readonly GamificationCelebration[]): void {
    if (admitted.length === 0) return;
    this.setState((state) => ({ ...state, celebrations: [...state.celebrations, ...admitted] }));
  }

  /** Queues celebrations the backend reported inline on an activity response. */
  private ingestActivityCelebrations(result: GamificationActivityResponse): void {
    const admitted: GamificationCelebration[] = [];

    const levelUp = result.level_up ?? null;
    if (levelUp) {
      const celebration = this.ledger.admit({
        kind: "level-up",
        id: levelUpEventId(levelUp.from_level, levelUp.to_level, levelUp.total_xp),
        fromLevel: levelUp.from_level,
        toLevel: levelUp.to_level,
        totalXp: levelUp.total_xp,
        level: result.level ?? null,
      });
      if (celebration) admitted.push(celebration);
    }

    for (const entry of result.newly_unlocked ?? []) {
      const id = typeof entry === "string" ? entry : entry.achievement_id;
      const view = typeof entry === "string" ? this.findAchievementView(id) : entry;
      if (!view) continue;
      const celebration = this.ledger.admit({
        kind: "achievement",
        id: achievementEventId(id),
        achievement: view,
      });
      if (celebration) admitted.push(celebration);
    }

    this.enqueueCelebrations(admitted);
  }

  /** Last known view for an achievement id, from any already-loaded response. */
  private findAchievementView(achievementId: string): AchievementView | null {
    const loaded: Array<AchievementsResponse | null> = [
      this.state.achievements.all.data,
      this.state.achievements.unlocked.data,
      this.state.achievements.locked.data,
    ];
    for (const response of loaded) {
      if (!response) continue;
      const view = response.achievements.find((entry) => entry.achievement_id === achievementId);
      if (view) return view;
    }
    return null;
  }

  /**
   * Called by a scan / activity flow with the backend's own response. The client
   * asserts no XP, level or completion of its own: it records any event the
   * response reported, then explicitly refreshes the slices a scan can change.
   */
  applyActivityResult(result: GamificationActivityResponse): Promise<void> {
    this.ingestActivityCelebrations(result);
    return this.refresh(ACTIVITY_SLICES);
  }

  /** For callers that only know "a scan happened". */
  refreshAfterActivity(): Promise<void> {
    return this.refresh(ACTIVITY_SLICES);
  }

  dismissCelebration(id: string): void {
    this.setState((state) => {
      if (!state.celebrations.some((celebration) => celebration.id === id)) return state;
      return {
        ...state,
        celebrations: state.celebrations.filter((celebration) => celebration.id !== id),
      };
    });
  }

  clearCelebrations(): void {
    this.setState((state) =>
      state.celebrations.length === 0 ? state : { ...state, celebrations: [] },
    );
  }

  /**
   * Clears the remembered event keys, so the once-per-event rule stays
   * inspectable rather than hidden state. Surfaced as a labelled control.
   */
  resetCelebrationHistory(): void {
    this.ledger.reset();
    this.clearCelebrations();
  }

  // ── rewards ──────────────────────────────────────────────────────────────

  /**
   * Claims a reward the backend reports as claimable. The client sends only the
   * reward's id; the returned view is merged in as-is and the affected slices
   * are re-read, so eligibility is never assumed to have changed.
   */
  async claimReward(reward: RewardView): Promise<void> {
    const key = reward.user_reward_id ?? reward.reward_id;
    this.setState((state) => ({
      ...state,
      claimError: null,
      claiming: { ...state.claiming, [key]: "claiming" },
    }));
    try {
      const result = await this.api.claimReward(reward.reward_id, reward.user_reward_id ?? undefined);
      this.setState((state) => ({
        ...state,
        claiming: {
          ...state.claiming,
          [key]: result.claimed || result.alreadyClaimed ? "claimed" : "failed",
        },
        rewards: this.mergeReward(state.rewards, result.reward),
        rewardHistory: this.mergeReward(state.rewardHistory, result.reward),
      }));
    } catch (error) {
      this.setState((state) => ({
        ...state,
        claimError: toApiError(error, "Unable to claim this reward"),
        claiming: { ...state.claiming, [key]: "failed" },
      }));
    } finally {
      await this.refresh(["rewards", "rewardHistory", "protection", "overview"]);
    }
  }

  private mergeReward(slice: SliceState<RewardListResponse>, reward: RewardView): SliceState<RewardListResponse> {
    const current = slice.data;
    if (!current) return slice;
    const rewards = current.rewards.map((entry) =>
      entry.reward_id === reward.reward_id ||
      (reward.user_reward_id != null && entry.user_reward_id === reward.user_reward_id)
        ? reward
        : entry,
    );
    return { ...slice, data: { ...current, rewards } };
  }

  clearClaimError(): void {
    this.setState((state) => (state.claimError === null ? state : { ...state, claimError: null }));
  }

  // ── lifecycle ────────────────────────────────────────────────────────────

  /** Aborts in-flight requests. Used when the provider tears down for good. */
  dispose(): void {
    for (const controller of this.aborts.values()) controller.abort();
    this.aborts.clear();
    this.inflight.clear();
    this.stale.clear();
    this.listeners.clear();
  }
}

let singleton: GamificationStore | null = null;

/** One store per browser tab, created lazily so SSR and tests stay isolated. */
export function getGamificationStore(): GamificationStore {
  if (typeof window === "undefined") return new GamificationStore();
  if (!singleton) singleton = new GamificationStore();
  return singleton;
}

/** Test seam: drops the tab singleton. */
export function resetGamificationStore(): void {
  singleton?.dispose();
  singleton = null;
}
