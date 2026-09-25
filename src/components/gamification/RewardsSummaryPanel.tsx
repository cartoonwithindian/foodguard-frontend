"use client";

import Link from "next/link";
import { Gift, ShieldCheck } from "lucide-react";
import { useGamificationOverview, useRewards } from "@/hooks/use-gamification";
import { formatCount, pluralize } from "@/lib/gamification/format";
import { Stat } from "./Stat";
import {
  GamificationEmpty,
  GamificationError,
  GamificationLoading,
  GamificationRefreshButton,
  GamificationStaleBanner,
} from "./States";
import styles from "./Gamification.module.css";

/**
 * The rewards summary that sits inside the gamification section.
 *
 * Counts come from `/api/gamification/overview`; the claimable list and the
 * claim action come from `/api/gamification/rewards`. The full rewards and
 * protection view lives at `/gamification/rewards`.
 */
export function RewardsSummaryPanel() {
  const overview = useGamificationOverview();
  const rewards = useRewards();
  const available = rewards.data?.available ?? overview.data?.rewards.available ?? 0;
  const earned = rewards.data?.earned ?? overview.data?.rewards.earned ?? 0;
  const protection = overview.data?.streak_protection ?? null;

  return (
    <section className={styles.card} aria-labelledby="gamification-rewards-heading">
      <div className={styles.cardHeader}>
        <div className="flex min-w-0 items-center gap-2">
          <Gift className="size-4 text-primary" aria-hidden="true" />
          <h2 id="gamification-rewards-heading" className="text-base font-semibold text-foreground">
            Rewards
          </h2>
        </div>
        <GamificationRefreshButton
          onClick={() => void rewards.reload()}
          busy={rewards.isRefreshing}
          label="Refresh rewards"
        />
      </div>

      <GamificationStaleBanner error={rewards.error} onRetry={() => void rewards.reload()} />

      {rewards.isInitialLoading ? (
        <GamificationLoading label="Loading rewards..." rows={2} />
      ) : null}

      {rewards.status === "error" && !rewards.data ? (
        <GamificationError error={rewards.error} onRetry={() => void rewards.reload()} />
      ) : null}

      {rewards.data ? (
        <div className={styles.statGrid}>
          <Stat label="Ready to claim" value={formatCount(available)} />
          <Stat label="Earned" value={formatCount(earned)} />
          <Stat label="Claimed" value={formatCount(rewards.data.claimed)} />
          <Stat
            label="Protection ready"
            value={protection ? `${protection.available_count} / ${protection.max_available}` : "—"}
          />
        </div>
      ) : null}

      {rewards.data && rewards.data.rewards.length === 0 ? (
        <GamificationEmpty
          title="No rewards configured"
          description="Rewards appear here as soon as they are configured and enabled."
        />
      ) : null}

      {overview.data ? (
        <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          {protection
            ? `${protection.available_count} of ${protection.max_available} ${pluralize(protection.max_available, "streak protection")} available, ${protection.used_count} used.`
            : "Streak protection details are unavailable right now."}
        </p>
      ) : null}

      <Link
        href="/gamification/rewards"
        className={`${styles.control} ${styles.controlGhost} no-underline`}
      >
        View rewards &amp; protection
      </Link>
    </section>
  );
}
