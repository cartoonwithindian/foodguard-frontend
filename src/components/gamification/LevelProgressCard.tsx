"use client";

import Link from "next/link";
import { Gift, Sparkles, TrendingUp } from "lucide-react";
import { formatCount, formatPercent } from "@/lib/gamification/format";
import type { GamificationOverview, LevelView } from "@/lib/gamification/types";
import { ProgressBar } from "./ProgressBar";
import { Stat } from "./Stat";
import styles from "./Gamification.module.css";

/**
 * Renders the backend's `LevelView` verbatim.
 *
 * The level number, the XP thresholds and the bar width all come from the API.
 * There is no level curve in this component: it cannot tell you what level a
 * given XP total is, because the backend owns that.
 */
export function LevelProgressCard({
  level,
  rewardsAvailable = 0,
  challengesCompleted = null,
}: {
  level: LevelView;
  rewardsAvailable?: number;
  challengesCompleted?: { completed: number; total: number } | null;
}) {
  const valueText = level.is_max_level
    ? `${formatCount(level.total_xp)} XP earned. Top level reached.`
    : `${formatCount(level.current_level_xp)} of ${formatCount(level.next_level_xp ?? 0)} XP toward level ${level.level + 1}. ${formatCount(level.xp_to_next_level)} XP to go.`;

  return (
    <section className={styles.card} aria-labelledby="gamification-level-heading">
      <div className={styles.cardHeader}>
        <div className="flex min-w-0 items-center gap-2">
          <TrendingUp className="size-4 text-primary" aria-hidden="true" />
          <h2 id="gamification-level-heading" className="text-sm font-semibold text-foreground">
            Your level
          </h2>
        </div>
        <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary-dark">
          {formatCount(level.total_xp)} XP total
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <p className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Level {level.level}
        </p>
        {level.is_max_level ? (
          <p className="pb-1 text-sm font-medium text-primary-dark">Highest level reached</p>
        ) : (
          <p className="pb-1 text-sm text-muted-foreground">
            {formatCount(level.xp_to_next_level)} XP to level {level.level + 1}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <ProgressBar
          ratio={level.progress}
          label={`Level ${level.level} progress`}
          value={level.current_level_xp}
          max={level.is_max_level ? undefined : (level.next_level_xp ?? undefined)}
          valueText={valueText}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{valueText}</span>
          {!level.is_max_level ? <span>{formatPercent(level.progress)}</span> : null}
        </div>
      </div>

      <div className={styles.statGrid}>
        <Stat label="Rewards ready" value={formatCount(rewardsAvailable)} />
        <Stat
          label="Challenges done"
          value={
            challengesCompleted
              ? `${challengesCompleted.completed} / ${challengesCompleted.total}`
              : "—"
          }
        />
        <Link
          href="/gamification/rewards"
          className={`${styles.control} ${styles.controlGhost} no-underline`}
        >
          <Gift className="size-4" aria-hidden="true" />
          Rewards
        </Link>
        <Link href="/challenges" className={`${styles.control} ${styles.controlGhost} no-underline`}>
          <Sparkles className="size-4" aria-hidden="true" />
          Challenges
        </Link>
      </div>
    </section>
  );
}
