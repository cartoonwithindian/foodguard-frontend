"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, RefreshCw, Sparkles, Trophy } from "lucide-react";
import {
  fetchGamificationProfile,
  GAMIFICATION_UPDATED_EVENT,
  type GamificationProfile,
} from "@/services/gamification.service";
import { useAuth } from "@/components/AuthProvider";

type LoadState = "loading" | "loaded" | "error" | "guest";

/** Small backend-backed card for the existing FoodGuard home screen. */
export function GamificationCard() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<LoadState>("loading");
  const [profile, setProfile] = useState<GamificationProfile | null>(null);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setProfile(null);
      setState("guest");
      return;
    }
    setState("loading");
    try {
      const next = await fetchGamificationProfile();
      setProfile(next);
      setState("loaded");
    } catch {
      setProfile(null);
      setState("error");
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    void load();
    const onUpdate = () => {
      void load();
    };
    window.addEventListener(GAMIFICATION_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(GAMIFICATION_UPDATED_EVENT, onUpdate);
  }, [load]);

  if (state === "guest") {
    return (
      <section className="foodguard-card p-5">
        <p className="text-sm font-medium text-foreground">
          Sign in to track your FoodGuard progress.
        </p>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="mt-3 inline-flex items-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Sign in
        </button>
      </section>
    );
  }

  if (state === "loading") {
    return (
      <section className="foodguard-card p-5" aria-live="polite">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
          Loading your FoodGuard progress...
        </div>
      </section>
    );
  }

  if (state === "error" || !profile) {
    return (
      <section className="foodguard-card border-red-200 bg-red-50/60 p-5" aria-live="polite">
        <p className="text-sm font-medium text-red-800 dark:text-red-200">
          Unable to load your progress.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-100 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900/40"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again.
        </button>
      </section>
    );
  }

  if (
    profile.total_xp === 0 &&
    profile.current_streak === 0 &&
    profile.longest_streak === 0
  ) {
    return (
      <section className="foodguard-card h-full border-primary/20 bg-primary-light/45 p-5 sm:p-6">
        <p className="foodguard-eyebrow text-primary-dark">FoodGuard progress</p>
        <h2 className="mt-2 text-lg font-semibold text-foreground">No scans yet</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Scan your first food product to start your FoodGuard journey.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
          <span className="rounded-full bg-white/80 px-3 py-1.5">0 XP</span>
          <span className="rounded-full bg-white/80 px-3 py-1.5">0 day streak</span>
        </div>
        <button
          type="button"
          onClick={() => router.push("/scan")}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Scan your first product
        </button>
      </section>
    );
  }

  return (
    <section className="foodguard-card h-full border-primary/20 bg-primary-light/45 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="foodguard-eyebrow text-primary-dark">FoodGuard progress</p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">Your daily streak</h2>
        </div>
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <Flame className="size-6" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-background/80 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Flame className="size-3.5" aria-hidden="true" />
            Current streak
          </div>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {profile.current_streak} {profile.current_streak === 1 ? "day" : "days"}
          </p>
        </div>
        <div className="rounded-xl bg-background/80 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Total XP
          </div>
          <p className="mt-1 text-lg font-semibold text-foreground">{profile.total_xp} XP</p>
        </div>
        <div className="rounded-xl bg-background/80 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Trophy className="size-3.5" aria-hidden="true" />
            Longest streak
          </div>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {profile.longest_streak} {profile.longest_streak === 1 ? "day" : "days"}
          </p>
        </div>
      </div>
      {profile.last_activity_date && (
        <p className="mt-3 text-xs text-muted-foreground">
          Last activity: {profile.last_activity_date}
        </p>
      )}
    </section>
  );
}
