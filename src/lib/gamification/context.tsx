"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { CHALLENGES_UPDATED_EVENT } from "@/services/challenge.service";
import { GAMIFICATION_UPDATED_EVENT } from "@/services/gamification.service";
import {
  ALL_SLICES,
  getGamificationStore,
  type DataSlice,
  type GamificationState,
  type GamificationStore,
} from "./store";

const GamificationStoreContext = createContext<GamificationStore | null>(null);

export type GamificationProviderProps = {
  children: ReactNode;
  /**
   * Slices this subtree needs. Defaults to the whole gamification section, so
   * the common case is one provider and no per-component fetching.
   */
  slices?: readonly DataSlice[];
  /** Injectable for tests; production uses the one-per-tab singleton. */
  store?: GamificationStore;
};

/**
 * Provides the gamification store to a subtree.
 *
 * The provider is the only place that triggers the initial load and the only
 * place that listens for the app-wide activity events, so a scan anywhere in
 * the app refreshes this state without any component re-fetching by itself.
 */
export function GamificationProvider({
  children,
  slices = ALL_SLICES,
  store,
}: GamificationProviderProps) {
  const value = useMemo(() => store ?? getGamificationStore(), [store]);

  useEffect(() => {
    void value.ensureLoaded(slices);
  }, [value, slices]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // A scan publishes these app-wide events; refreshing from them is what
    // keeps levels, streaks, achievements and challenges truthful after one.
    const onGamificationActivity = () => void value.refreshAfterActivity();
    const onChallenges = () => void value.refresh(["challenges"]);
    window.addEventListener(GAMIFICATION_UPDATED_EVENT, onGamificationActivity);
    window.addEventListener(CHALLENGES_UPDATED_EVENT, onChallenges);
    return () => {
      window.removeEventListener(GAMIFICATION_UPDATED_EVENT, onGamificationActivity);
      window.removeEventListener(CHALLENGES_UPDATED_EVENT, onChallenges);
    };
  }, [value]);

  return (
    <GamificationStoreContext.Provider value={value}>{children}</GamificationStoreContext.Provider>
  );
}

/** The store itself, for refreshes and mutations. Throws outside the provider. */
export function useGamificationStore(): GamificationStore {
  const store = useContext(GamificationStoreContext);
  if (!store) {
    throw new Error("useGamificationStore must be used inside <GamificationProvider>");
  }
  return store;
}

/** Subscribes to the whole store snapshot. */
export function useGamificationState(): GamificationState {
  const store = useGamificationStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
