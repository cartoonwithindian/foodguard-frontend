"use client";

import Link from "next/link";
import { Target } from "lucide-react";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { useGamificationChallenges, useGamificationOverview } from "@/hooks/use-gamification";
import { formatCount } from "@/lib/gamification/format";
import { Stat } from "./Stat";
import {
  GamificationEmpty,
  GamificationError,
  GamificationLoading,
  GamificationRefreshButton,
  GamificationStaleBanner,
} from "./States";
import styles from "./Gamification.module.css";

const PREVIEW_LIMIT = 3;

/**
 * Challenge progress inside the gamification section.
 *
 * Period totals come from `/api/gamification/overview`; the cards come from
 * `/api/gamification/challenges` and reuse the existing `ChallengeCard`, so the
 * gamification section and `/challenges` can never disagree about a challenge.
 */
export function ChallengesSummaryPanel() {
  const overview = useGamificationOverview();
  const challenges = useGamificationChallenges();
  const data = challenges.data;
  const preview = [...(data?.daily ?? []), ...(data?.weekly ?? [])].slice(0, PREVIEW_LIMIT);
  const counts = overview.data?.challenges ?? null;

  return (
    <section className={styles.section} aria-labelledby="gamification-challenges-heading">
      <div className={styles.cardHeader}>
        <div className="flex min-w-0 items-center gap-2">
          <Target className="size-4 text-primary" aria-hidden="true" />
          <h2
            id="gamification-challenges-heading"
            className="text-base font-semibold text-foreground"
          >
            Challenges
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <GamificationRefreshButton
            onClick={() => void challenges.reload()}
            busy={challenges.isRefreshing}
            label="Refresh challenges"
          />
          <Link href="/challenges" className={`${styles.control} ${styles.controlGhost} no-underline`}>
            See all
          </Link>
        </div>
      </div>

      <GamificationStaleBanner error={challenges.error} onRetry={() => void challenges.reload()} />

      {overview.isInitialLoading || challenges.isInitialLoading ? (
        <GamificationLoading label="Loading challenges..." rows={2} />
      ) : null}

      {challenges.status === "error" && !challenges.data ? (
        <GamificationError error={challenges.error} onRetry={() => void challenges.reload()} />
      ) : null}

      {counts ? (
        <div className={styles.statGrid}>
          <Stat
            label="Daily done"
            value={`${formatCount(counts.daily_completed)} / ${formatCount(counts.daily_total)}`}
          />
          <Stat
            label="Weekly done"
            value={`${formatCount(counts.weekly_completed)} / ${formatCount(counts.weekly_total)}`}
          />
          <Stat label="Active daily" value={data ? formatCount(data.daily.length) : "—"} />
          <Stat label="Active weekly" value={data ? formatCount(data.weekly.length) : "—"} />
        </div>
      ) : null}

      {data ? (
        preview.length > 0 ? (
          <div className={styles.grid}>
            {preview.map((challenge) => (
              <ChallengeCard key={`${challenge.challenge_type}-${challenge.challenge_id}`} challenge={challenge} />
            ))}
          </div>
        ) : (
          <GamificationEmpty
            title="No active challenges"
            description="New challenges appear here when they are configured and enabled."
          />
        )
      ) : null}
    </section>
  );
}
