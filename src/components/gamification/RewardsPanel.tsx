"use client";

import { Gift } from "lucide-react";
import { useRewardHistory, useRewards } from "@/hooks/use-gamification";
import { formatCount, formatDate } from "@/lib/gamification/format";
import { RewardCard } from "./RewardCard";
import { HistoryRow } from "./HistoryRow";
import {
  GamificationEmpty,
  GamificationError,
  GamificationLoading,
  GamificationRefreshButton,
  GamificationStaleBanner,
} from "./States";
import styles from "./Gamification.module.css";

/**
 * The rewards list plus the claim action.
 *
 * `GET /api/gamification/rewards` supplies the list, and the same endpoint's
 * `GET /api/gamification/rewards/history` supplies the history strip. Claiming
 * posts only the reward id to `/api/gamification/rewards/claim`.
 */
export function RewardsPanel() {
  const rewards = useRewards();
  const history = useRewardHistory();
  const list = rewards.data?.rewards ?? [];
  const earned = (history.data?.rewards ?? []).filter((reward) => reward.earned);

  return (
    <section className={styles.section} aria-labelledby="gamification-rewards-list-heading">
      <div className={styles.cardHeader}>
        <div className="flex min-w-0 items-center gap-2">
          <Gift className="size-4 text-primary" aria-hidden="true" />
          <h2
            id="gamification-rewards-list-heading"
            className="text-base font-semibold text-foreground"
          >
            Rewards
          </h2>
          {rewards.data ? (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
              {formatCount(rewards.data.available)} ready
            </span>
          ) : null}
        </div>
        <GamificationRefreshButton
          onClick={() => {
            void rewards.reload();
            void history.reload();
          }}
          busy={rewards.isRefreshing || history.isRefreshing}
          label="Refresh rewards"
        />
      </div>

      <GamificationStaleBanner
        error={rewards.error ?? history.error}
        onRetry={() => {
          void rewards.reload();
          void history.reload();
        }}
      />

      {rewards.claimError ? (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span className="min-w-0 text-foreground">{rewards.claimError.message}</span>
          <button
            type="button"
            className={`${styles.control} ${styles.controlGhost}`}
            onClick={rewards.clearClaimError}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {rewards.isInitialLoading ? <GamificationLoading label="Loading rewards..." rows={3} /> : null}

      {rewards.status === "error" && !rewards.data ? (
        <GamificationError error={rewards.error} onRetry={() => void rewards.reload()} />
      ) : null}

      {rewards.data && list.length === 0 ? (
        <GamificationEmpty
          title="No rewards configured"
          description="Rewards appear here as soon as they are configured and enabled."
        />
      ) : null}

      {list.length > 0 ? (
        <div className={`${styles.grid} ${styles.gridThree}`}>
          {list.map((reward) => (
            <RewardCard
              key={reward.user_reward_id ?? reward.reward_id}
              reward={reward}
              claimState={rewards.claimStateOf(reward)}
              onClaim={(target) => void rewards.claim(target)}
            />
          ))}
        </div>
      ) : null}

      <div className={styles.card}>
        <h3 className="text-sm font-semibold text-foreground">Earned rewards</h3>
        {history.isInitialLoading ? <GamificationLoading label="Loading history..." rows={2} /> : null}
        {history.status === "error" && !history.data ? (
          <GamificationError error={history.error} onRetry={() => void history.reload()} />
        ) : null}
        {history.data ? (
          earned.length > 0 ? (
            <div>
              {earned.map((reward) => (
                <HistoryRow
                  key={`earned-${reward.user_reward_id ?? reward.reward_id}`}
                  title={reward.name}
                  detail={`${reward.earned_at ? `Earned ${formatDate(reward.earned_at)}` : "Earned"}${
                    reward.claimed_at ? ` · claimed ${formatDate(reward.claimed_at)}` : ""
                  }`}
                  meta={reward.claimed ? "Claimed" : "Ready"}
                  tone={reward.claimed ? "muted" : "default"}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Rewards you have earned will be listed here.
            </p>
          )
        ) : null}
      </div>
    </section>
  );
}
