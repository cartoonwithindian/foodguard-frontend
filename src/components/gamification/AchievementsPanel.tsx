"use client";

import { useState } from "react";
import { Award } from "lucide-react";
import { useAchievements } from "@/hooks/use-gamification";
import { formatCount } from "@/lib/gamification/format";
import { FILTERS } from "@/lib/gamification/store";
import type { AchievementFilter } from "@/lib/gamification/types";
import { AchievementCard } from "./AchievementCard";
import {
  GamificationEmpty,
  GamificationError,
  GamificationLoading,
  GamificationStaleBanner,
} from "./States";
import styles from "./Gamification.module.css";

const FILTER_LABELS: Record<AchievementFilter, string> = {
  all: "All",
  unlocked: "Unlocked",
  locked: "Locked",
};

/**
 * The achievements panel.
 *
 * `GET /api/gamification/achievements?filter=` is asked per tab, through the
 * shared store, so switching tabs never blanks the panel and never produces a
 * second copy of the same request.
 */
export function AchievementsPanel() {
  const [filter, setFilter] = useState<AchievementFilter>("all");
  const { data, status, error, isRefreshing, isInitialLoading, reload } = useAchievements(filter);
  const achievements = data?.achievements ?? [];
  const emptyMessage =
    filter === "unlocked"
      ? "No achievements unlocked yet. Keep checking products and ingredients."
      : filter === "locked"
        ? "Every achievement is unlocked."
        : "No achievements are configured yet.";

  return (
    <section className={styles.section} aria-labelledby="gamification-achievements-heading">
      <div className={styles.cardHeader}>
        <div className="flex min-w-0 items-center gap-2">
          <Award className="size-4 text-primary" aria-hidden="true" />
          <h2
            id="gamification-achievements-heading"
            className="text-base font-semibold text-foreground"
          >
            Achievements
          </h2>
          {data ? (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
              {formatCount(data.unlocked)} / {formatCount(data.total)}
            </span>
          ) : null}
        </div>
      </div>

      <div className={styles.filterBar} role="tablist" aria-label="Achievement filter">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`achievements-tab-${value}`}
            aria-selected={filter === value}
            aria-controls="achievements-panel"
            className={`${styles.filterTab} ${filter === value ? styles.filterTabActive : ""}`}
            onClick={() => setFilter(value)}
          >
            {FILTER_LABELS[value]}
          </button>
        ))}
      </div>

      <GamificationStaleBanner error={error} onRetry={() => void reload()} />

      <div
        id="achievements-panel"
        role="tabpanel"
        aria-labelledby={`achievements-tab-${filter}`}
        className={`${styles.grid} ${styles.gridThree}`}
      >
        {isInitialLoading ? <GamificationLoading label="Loading achievements..." /> : null}

        {status === "error" && !data ? (
          <div className={styles.spanAll}>
            <GamificationError error={error} onRetry={() => void reload()} />
          </div>
        ) : null}

        {status === "loaded" && achievements.length === 0 ? (
          <div className={styles.spanAll}>
            <GamificationEmpty title="Nothing here yet" description={emptyMessage} />
          </div>
        ) : null}

        {achievements.map((achievement) => (
          <AchievementCard key={achievement.achievement_id} achievement={achievement} />
        ))}
      </div>

      {isRefreshing ? (
        <p className={styles.stateRow} aria-live="polite">
          Refreshing achievements...
        </p>
      ) : null}
    </section>
  );
}
