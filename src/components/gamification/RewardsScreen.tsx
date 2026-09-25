"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { GamificationProvider } from "@/lib/gamification/context";
import { useGamificationOverview, useRefreshGamification } from "@/hooks/use-gamification";
import { CelebrationLayer } from "./CelebrationLayer";
import { LevelProgressCard } from "./LevelProgressCard";
import { RewardsPanel } from "./RewardsPanel";
import { StreakCard } from "./StreakCard";
import { StreakProtectionPanel } from "./StreakProtectionPanel";
import {
  GamificationError,
  GamificationLoading,
  GamificationRefreshButton,
  GamificationStaleBanner,
} from "./States";
import styles from "./Gamification.module.css";

const REWARDS_SLICES = [
  "overview",
  "achievementsAll",
  "rewards",
  "rewardHistory",
  "protection",
  "protectionHistory",
] as const;

function RewardsHeader() {
  const router = useRouter();
  const refresh = useRefreshGamification();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => router.push("/gamification")}
          className={styles.iconButton}
          aria-label="Back to rewards and progress"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <Trophy className="size-5 text-primary" aria-hidden="true" />
        <h1 className="text-base font-semibold text-foreground">Rewards &amp; protection</h1>
        <div className="ml-auto flex items-center gap-2">
          <GamificationRefreshButton
            onClick={() => void refresh()}
            busy={false}
            label="Refresh"
          />
          <Link
            href="/gamification"
            className="text-xs font-semibold text-primary hover:text-primary-dark"
          >
            All progress
          </Link>
        </div>
      </div>
    </header>
  );
}

function RewardsOverview() {
  const overview = useGamificationOverview();
  const data = overview.data;

  return (
    <div className={styles.stack}>
      <GamificationStaleBanner error={overview.error} onRetry={() => void overview.reload()} />
      {overview.isInitialLoading ? <GamificationLoading label="Loading your progress..." rows={2} /> : null}
      {overview.status === "error" && !data ? (
        <GamificationError error={overview.error} onRetry={() => void overview.reload()} />
      ) : null}
      {data ? (
        <div className={styles.grid}>
          <LevelProgressCard
            level={data.level}
            rewardsAvailable={data.rewards.available}
            challengesCompleted={{
              completed: data.challenges.daily_completed + data.challenges.weekly_completed,
              total: data.challenges.daily_total + data.challenges.weekly_total,
            }}
          />
          <StreakCard
            currentStreak={data.current_streak}
            longestStreak={data.longest_streak}
            protection={data.streak_protection}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The rewards and streak-protection view.
 *
 * `achievementsAll` stays in the slice list on purpose: that response is the
 * one the backend reports level-ups and new unlocks on, so it is what keeps the
 * celebration feed working on this route too.
 */
export function RewardsScreen() {
  return (
    <GamificationProvider slices={REWARDS_SLICES}>
      <div className="min-h-screen bg-background pb-16">
        <RewardsHeader />
        <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          <div className="max-w-2xl">
            <p className="foodguard-eyebrow text-primary">Milestones</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Rewards &amp; streak protection
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              FoodGuard decides which rewards you have earned from your own activity. Claiming
              one only tells FoodGuard which reward to hand over -- it cannot award something you
              have not earned.
            </p>
          </div>

          <RewardsOverview />
          <RewardsPanel />
          <StreakProtectionPanel />
        </main>
        <CelebrationLayer />
      </div>
    </GamificationProvider>
  );
}
