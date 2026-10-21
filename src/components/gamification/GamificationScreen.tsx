"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Trophy } from "lucide-react";
import { GamificationProvider } from "@/lib/gamification/context";
import {
  useGamificationCelebrations,
  useGamificationOverview,
  useGamificationState,
  useRefreshGamification,
} from "@/hooks/use-gamification";
import { AchievementsPanel } from "./AchievementsPanel";
import { CelebrationLayer } from "./CelebrationLayer";
import { ChallengesSummaryPanel } from "./ChallengesSummaryPanel";
import { LevelProgressCard } from "./LevelProgressCard";
import { RewardsSummaryPanel } from "./RewardsSummaryPanel";
import { StreakCard } from "./StreakCard";
import {
  GamificationError,
  GamificationLoading,
  GamificationRefreshButton,
  GamificationStaleBanner,
} from "./States";
import styles from "./Gamification.module.css";

const SECTION_SLICES = [
  "overview",
  "achievementsAll",
  "challenges",
  "rewards",
  "protection",
] as const;

function ScreenHeader() {
  const router = useRouter();
  const { resetHistory } = useGamificationCelebrations();

  return (
    <header className="sticky top-14 z-30 lg:top-0 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => router.push("/")}
          className={styles.iconButton}
          aria-label="Back to home"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <Trophy className="size-5 text-primary" aria-hidden="true" />
        <h1 className="text-base font-semibold text-foreground">Rewards &amp; progress</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className={`${styles.control} ${styles.controlGhost} hidden sm:inline-flex`}
            onClick={resetHistory}
            title="Show level-up and achievement notifications again"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            Replay celebrations
          </button>
          <Link href="/" className="text-xs font-semibold text-primary hover:text-primary-dark">
            FoodGuard home
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Refreshes the whole section, including the slices loaded behind the scenes. */
function SectionRefreshButton() {
  const refresh = useRefreshGamification();
  const state = useGamificationState();
  const busy =
    state.overview.status === "loading" ||
    state.challenges.status === "loading" ||
    state.rewards.status === "loading" ||
    state.protection.status === "loading" ||
    state.achievements.all.status === "loading";

  return <GamificationRefreshButton onClick={() => void refresh()} busy={busy} label="Refresh all" />;
}

function OverviewBody() {
  const overview = useGamificationOverview();
  const data = overview.data;

  return (
    <div className={styles.stack}>
      <GamificationStaleBanner error={overview.error} onRetry={() => void overview.reload()} />

      {overview.isInitialLoading ? <GamificationLoading label="Loading your progress..." rows={3} /> : null}

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
 * The gamification section: level and progress, streak, achievements,
 * challenges and a rewards summary, with the full rewards/protection view one
 * link away.
 *
 * One provider owns every request. The panels below only read slices of it.
 */
export function GamificationScreen() {
  return (
    <GamificationProvider slices={SECTION_SLICES}>
      <div className="min-h-screen bg-background pb-16">
        <ScreenHeader />
        <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="foodguard-eyebrow text-primary">Your FoodGuard journey</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Levels, streaks and achievements
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Every number below is read from your FoodGuard activity: scanning products,
                checking ingredients and asking questions. FoodGuard records the progress as
                you use the app.
              </p>
            </div>
            <SectionRefreshButton />
          </div>

          <OverviewBody />
          <ChallengesSummaryPanel />
          <AchievementsPanel />
          <RewardsSummaryPanel />
        </main>
        <CelebrationLayer />
      </div>
    </GamificationProvider>
  );
}
