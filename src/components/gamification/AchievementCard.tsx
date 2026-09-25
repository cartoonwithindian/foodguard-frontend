"use client";

import { Check, Lock } from "lucide-react";
import { conditionLabel, formatCount, formatDate, formatPercent } from "@/lib/gamification/format";
import type { AchievementView } from "@/lib/gamification/types";
import { ProgressBar } from "./ProgressBar";
import styles from "./Gamification.module.css";

/**
 * One achievement with the progress the backend recorded.
 *
 * A locked achievement stays visible with its real progress. It is never
 * styled or labelled as earned, because the client has no say in whether it is.
 */
export function AchievementCard({ achievement }: { achievement: AchievementView }) {
  const unlockedAt = formatDate(achievement.unlocked_at);

  return (
    <article
      className={styles.card}
      aria-labelledby={`achievement-${achievement.achievement_id}-name`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
            achievement.unlocked ? "bg-primary-light" : "bg-muted"
          }`}
          aria-hidden="true"
        >
          <span className="text-xl leading-none">{achievement.icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3
              id={`achievement-${achievement.achievement_id}-name`}
              className="text-sm font-semibold text-foreground"
            >
              {achievement.name}
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                achievement.unlocked
                  ? "bg-primary-light text-primary-dark"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {achievement.unlocked ? (
                <>
                  <Check className="size-3" aria-hidden="true" />
                  Unlocked
                </>
              ) : (
                <>
                  <Lock className="size-3" aria-hidden="true" />
                  Locked
                </>
              )}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{achievement.description}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <ProgressBar
          ratio={achievement.progress_ratio}
          locked={!achievement.unlocked}
          label={`${achievement.name} progress`}
          value={achievement.progress}
          max={achievement.target}
          valueText={`${formatCount(achievement.progress)} of ${formatCount(achievement.target)} ${conditionLabel(achievement.condition_type)}`}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {formatCount(achievement.progress)} / {formatCount(achievement.target)}{" "}
            {conditionLabel(achievement.condition_type)}
          </span>
          <span>{achievement.unlocked ? unlockedAt ?? "Unlocked" : formatPercent(achievement.progress_ratio)}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Reward: {formatCount(achievement.reward_xp)} XP
      </p>
    </article>
  );
}
