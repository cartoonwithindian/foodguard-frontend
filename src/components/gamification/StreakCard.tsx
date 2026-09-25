"use client";

import Link from "next/link";
import { Flame, ShieldCheck, Trophy } from "lucide-react";
import { formatCount, formatDate, pluralize } from "@/lib/gamification/format";
import type { StreakProtectionSummary } from "@/lib/gamification/types";
import { Stat } from "./Stat";
import styles from "./Gamification.module.css";

/**
 * Streak state and protection inventory.
 *
 * `current_streak` / `longest_streak` come from the overview, and the protection
 * counts from `/api/gamification/streak-protection` (or the same figures on the
 * overview payload). Nothing here decides what a streak is or whether a day was
 * bridged -- the backend resolved both.
 */
export function StreakCard({
  currentStreak,
  longestStreak,
  protection,
}: {
  currentStreak: number;
  longestStreak: number;
  protection: StreakProtectionSummary | null;
}) {
  const lastProtected = protection?.last_protected ?? null;
  const lastProtectedDay = formatDate(lastProtected?.protected_date ?? null);

  return (
    <section className={styles.card} aria-labelledby="gamification-streak-heading">
      <div className={styles.cardHeader}>
        <div className="flex min-w-0 items-center gap-2">
          <Flame className="size-4 text-amber-500" aria-hidden="true" />
          <h2 id="gamification-streak-heading" className="text-sm font-semibold text-foreground">
            Daily streak
          </h2>
        </div>
        <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary-dark">
          {currentStreak} {pluralize(currentStreak, "day")}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        {currentStreak > 0
          ? `You have checked a product ${currentStreak} ${pluralize(currentStreak, "day")} in a row.`
          : "No active streak. Scanning a product today starts one."}
      </p>

      <div className={styles.statGrid}>
        <Stat label="Current streak" value={`${formatCount(currentStreak)} ${pluralize(currentStreak, "day")}`} />
        <Stat label="Longest streak" value={`${formatCount(longestStreak)} ${pluralize(longestStreak, "day")}`} />
        <Stat
          label="Protection ready"
          value={protection ? `${protection.available_count} / ${protection.max_available}` : "—"}
        />
        <Stat label="Protection used" value={protection ? formatCount(protection.used_count) : "—"} />
      </div>

      {lastProtected ? (
        <p className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Last protected day: {lastProtectedDay ?? lastProtected.protected_date}
        </p>
      ) : null}

      <Link href="/gamification/rewards" className={`${styles.control} ${styles.controlGhost} no-underline`}>
        <Trophy className="size-4" aria-hidden="true" />
        Rewards &amp; protection
      </Link>
    </section>
  );
}
