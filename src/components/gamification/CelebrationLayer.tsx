"use client";

import { useEffect, useRef } from "react";
import { Award, PartyPopper, X } from "lucide-react";
import { useGamificationCelebrations } from "@/hooks/use-gamification";
import { formatCount, formatPercent } from "@/lib/gamification/format";
import type { GamificationCelebration } from "@/lib/gamification/celebrations";
import styles from "./Gamification.module.css";

/** How long a single celebration stays on screen before it dismisses itself. */
const AUTO_DISMISS_MS = 9000;

function CelebrationBody({ celebration }: { celebration: GamificationCelebration }) {
  if (celebration.kind === "level-up") {
    return (
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          Level {celebration.fromLevel} &rarr; Level {celebration.toLevel}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatCount(celebration.totalXp)} XP earned.
          {celebration.level && !celebration.level.is_max_level
            ? ` ${formatCount(celebration.level.xp_to_next_level)} XP to level ${celebration.level.level + 1}.`
            : ""}
        </p>
      </div>
    );
  }

  const { achievement } = celebration;
  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-foreground">
        <span aria-hidden="true">{achievement.icon} </span>
        {achievement.name} unlocked
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {achievement.description} &middot; {formatCount(achievement.reward_xp)} XP
        {achievement.target > 0
          ? ` · ${formatCount(achievement.progress)} / ${formatCount(achievement.target)} (${formatPercent(achievement.progress_ratio)})`
          : ""}
      </p>
    </div>
  );
}

function CelebrationCard({
  celebration,
  onDismiss,
}: {
  celebration: GamificationCelebration;
  onDismiss: (id: string) => void;
}) {
  const isLevelUp = celebration.kind === "level-up";

  return (
    <div
      className={styles.celebrationCard}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="mt-0.5 shrink-0 text-primary" aria-hidden="true">
        {isLevelUp ? <PartyPopper className="size-5" /> : <Award className="size-5" />}
      </span>
      <CelebrationBody celebration={celebration} />
      <button
        type="button"
        className={styles.celebrationClose}
        onClick={() => onDismiss(celebration.id)}
        aria-label={`Dismiss ${isLevelUp ? "level up" : "achievement"} notification`}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Renders the store's celebration queue.
 *
 * The queue is already de-duplicated: the store admits each backend event
 * (`level_up`, `newly_unlocked`) through a ledger keyed on the event itself, so
 * a re-render, a remount or a refetch cannot enqueue it twice. This component
 * only displays and dismisses.
 */
export function CelebrationLayer() {
  const { celebrations, dismiss } = useGamificationCelebrations();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    for (const celebration of celebrations) {
      if (pending.has(celebration.id)) continue;
      const handle = setTimeout(() => {
        pending.delete(celebration.id);
        dismiss(celebration.id);
      }, AUTO_DISMISS_MS);
      pending.set(celebration.id, handle);
    }
  }, [celebrations, dismiss]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const handle of pending.values()) clearTimeout(handle);
      pending.clear();
    };
  }, []);

  if (celebrations.length === 0) return null;

  return (
    <div className={styles.celebrationLayer}>
      {celebrations.map((celebration) => (
        <CelebrationCard key={celebration.id} celebration={celebration} onDismiss={dismiss} />
      ))}
    </div>
  );
}
