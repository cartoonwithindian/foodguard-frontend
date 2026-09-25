"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useGamificationState, useGamificationStore } from "@/lib/gamification/context";import {
  ACTIVITY_SLICES,
  ALL_SLICES,
  FILTER_SLICES,
  type ClaimState,
  type DataSlice,
  type SliceState,
} from "@/lib/gamification/store";
import type { GamificationCelebration } from "@/lib/gamification/celebrations";
import type { GamificationApiError } from "@/lib/gamification/api";
import type {
  AchievementFilter,
  AchievementsResponse,
  ChallengeListResponse,
  GamificationActivityResponse,
  GamificationOverview,
  RewardListResponse,
  RewardView,
  StreakProtectionHistoryResponse,
  StreakProtectionStatus,
} from "@/lib/gamification/types";

/**
 * The component-facing surface of the gamification state layer.
 *
 * Every hook here reads a slice of the one shared store. None of them fetch on
 * their own behalf, and none of them derive a level, streak, achievement or
 * reward: each number they hand back came from an API response.
 */

export type SliceView<T> = {
  data: T | null;
  status: SliceState<T>["status"];
  error: GamificationApiError | null;
  /** True while a refresh is in flight over data that is already on screen. */
  isRefreshing: boolean;
  /** True before the first response has ever arrived. */
  isInitialLoading: boolean;
  reload: () => Promise<void>;
};

function toSliceView<T>(slice: SliceState<T>, reload: () => Promise<void>): SliceView<T> {
  return {
    data: slice.data,
    status: slice.status,
    error: slice.error,
    isRefreshing: slice.status === "loading" && slice.data !== null,
    isInitialLoading: slice.status === "loading" && slice.data === null,
    reload,
  };
}

/** `GET /api/gamification/overview` - the payload behind the section header. */
export function useGamificationOverview(): SliceView<GamificationOverview> {
  const state = useGamificationState();
  const store = useGamificationStore();
  const reload = useCallback(() => store.refresh(["overview"]), [store]);
  return useMemo(() => toSliceView(state.overview, reload), [state.overview, reload]);
}

/**
 * `GET /api/gamification/achievements?filter=`. Each filter keeps its own slice,
 * so switching tabs shows its own loading state instead of blanking the panel.
 * The unfiltered response is the one the backend reports unlocks on, and it is
 * the only feed the celebration ledger reads.
 */
export function useAchievements(filter: AchievementFilter = "all"): SliceView<AchievementsResponse> {
  const state = useGamificationState();
  const store = useGamificationStore();
  const slice = FILTER_SLICES[filter];

  useEffect(() => {
    void store.load(slice);
  }, [store, slice]);

  const reload = useCallback(() => store.refresh([slice]), [store, slice]);
  return useMemo(() => toSliceView(state.achievements[filter], reload), [state.achievements, filter, reload]);
}

/** `GET /api/gamification/rewards`, plus the claim action. */
export function useRewards(): SliceView<RewardListResponse> & {
  claim: (reward: RewardView) => Promise<void>;
  claimStateOf: (reward: RewardView) => ClaimState | undefined;
  claimError: GamificationApiError | null;
  clearClaimError: () => void;
} {
  const state = useGamificationState();
  const store = useGamificationStore();
  const reload = useCallback(() => store.refresh(["rewards"]), [store]);
  const view = useMemo(() => toSliceView(state.rewards, reload), [state.rewards, reload]);

  return useMemo(
    () => ({
      ...view,
      claim: (reward: RewardView) => store.claimReward(reward),
      claimStateOf: (reward: RewardView) => state.claiming[reward.user_reward_id ?? reward.reward_id],
      claimError: state.claimError,
      clearClaimError: () => store.clearClaimError(),
    }),
    [view, state.claiming, state.claimError, store],
  );
}

/** `GET /api/gamification/rewards/history` */
export function useRewardHistory(): SliceView<RewardListResponse> {
  const state = useGamificationState();
  const store = useGamificationStore();
  const reload = useCallback(() => store.refresh(["rewardHistory"]), [store]);
  return useMemo(() => toSliceView(state.rewardHistory, reload), [state.rewardHistory, reload]);
}

/** `GET /api/gamification/streak-protection` */
export function useStreakProtection(): SliceView<StreakProtectionStatus> {
  const state = useGamificationState();
  const store = useGamificationStore();
  const reload = useCallback(() => store.refresh(["protection"]), [store]);
  return useMemo(() => toSliceView(state.protection, reload), [state.protection, reload]);
}

/** `GET /api/gamification/streak-protection/history` */
export function useStreakProtectionHistory(): SliceView<StreakProtectionHistoryResponse> {
  const state = useGamificationState();
  const store = useGamificationStore();
  const reload = useCallback(() => store.refresh(["protectionHistory"]), [store]);
  return useMemo(() => toSliceView(state.protectionHistory, reload), [state.protectionHistory, reload]);
}

/** `GET /api/gamification/challenges` */
export function useGamificationChallenges(): SliceView<ChallengeListResponse> {
  const state = useGamificationState();
  const store = useGamificationStore();
  const reload = useCallback(() => store.refresh(["challenges"]), [store]);
  return useMemo(() => toSliceView(state.challenges, reload), [state.challenges, reload]);
}

/**
 * The once-per-event celebration queue. Every entry is a real backend event
 * (`level_up` or `newly_unlocked`), and the store's ledger guarantees a given
 * event appears here at most once, so the UI can render them without keeping
 * its own "have I shown this?" flag.
 */
export function useGamificationCelebrations(): {
  celebrations: GamificationCelebration[];
  dismiss: (id: string) => void;
  clear: () => void;
  resetHistory: () => void;
} {
  const state = useGamificationState();
  const store = useGamificationStore();
  return useMemo(
    () => ({
      celebrations: state.celebrations,
      dismiss: (id: string) => store.dismissCelebration(id),
      clear: () => store.clearCelebrations(),
      resetHistory: () => store.resetCelebrationHistory(),
    }),
    [state.celebrations, store],
  );
}

/** Manual refresh, e.g. a retry or a refresh button. */
export function useRefreshGamification(): (slices?: readonly DataSlice[]) => Promise<void> {
  const store = useGamificationStore();
  return useCallback((slices: readonly DataSlice[] = ALL_SLICES) => store.refresh(slices), [store]);
}

/**
 * The integration point for a scan flow: hands the backend's own activity
 * response to the store, which records any level-up / unlock the response
 * reported and then explicitly refreshes every slice a scan can move.
 */
export function useRecordGamificationActivity(): (
  result: GamificationActivityResponse,
) => Promise<void> {
  const store = useGamificationStore();
  return useCallback(
    (result: GamificationActivityResponse) => store.applyActivityResult(result),
    [store],
  );
}

export { ACTIVITY_SLICES, ALL_SLICES };
export { useGamificationState, useGamificationStore } from "@/lib/gamification/context";
export type { DataSlice };
