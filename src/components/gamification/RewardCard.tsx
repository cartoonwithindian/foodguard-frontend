"use client";

import { Check, Gift, Lock, ShieldPlus, Sparkles } from "lucide-react";
import { formatCount, formatDate, pluralize } from "@/lib/gamification/format";
import type { ClaimState } from "@/lib/gamification/store";
import type { RewardView } from "@/lib/gamification/types";
import { ProgressBar } from "./ProgressBar";
import styles from "./Gamification.module.css";

/**
 * A reward and this user's real standing on it.
 *
 * `eligible`, `earned` and `claimed` are the backend's answers. The button is
 * enabled only when the server said `requires_claim && earned && !claimed`, and
 * posting it names the reward -- it never asserts that the reward was earned.
 */
export function RewardCard({
  reward,
  claimState,
  onClaim,
}: {
  reward: RewardView;
  claimState: ClaimState | undefined;
  onClaim: (reward: RewardView) => void;
}) {
  const claiming = claimState === "claiming";
  const claimed = reward.claimed;
  const claimable = reward.requires_claim && reward.earned && !claimed;
  const earnedAt = formatDate(reward.earned_at);
  const claimedAt = formatDate(reward.claimed_at);

  const isProtection = reward.reward_type === "STREAK_PROTECTION";
  const rewardValue = isProtection
    ? `${formatCount(reward.reward_value)} ${pluralize(reward.reward_value, "streak protection")}`
    : `${formatCount(reward.reward_value)} XP`;

  return (
    <article className={styles.card} aria-labelledby={`reward-${reward.reward_id}-name`}>
      <div className="flex items-start gap-3">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
            reward.earned ? "bg-primary-light text-primary" : "bg-muted text-muted-foreground"
          }`}
          aria-hidden="true"
        >
          {isProtection ? <ShieldPlus className="size-5" /> : <Gift className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id={`reward-${reward.reward_id}-name`} className="text-sm font-semibold text-foreground">
              {reward.name}
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                claimed
                  ? "bg-primary-light text-primary-dark"
                  : reward.earned
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {claimed ? (
                <>
                  <Check className="size-3" aria-hidden="true" />
                  Claimed
                </>
              ) : reward.earned ? (
                <>
                  <Sparkles className="size-3" aria-hidden="true" />
                  Earned
                </>
              ) : (
                <>
                  <Lock className="size-3" aria-hidden="true" />
                  {reward.eligible ? "Eligible" : "Locked"}
                </>
              )}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{reward.description}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <ProgressBar
          ratio={reward.target > 0 ? reward.progress / reward.target : 0}
          locked={!reward.earned}
          label={`${reward.name} progress`}
          value={reward.progress}
          max={reward.target}
          valueText={`${formatCount(reward.progress)} of ${formatCount(reward.target)}`}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {formatCount(reward.progress)} / {formatCount(reward.target)}
          </span>
          <span>
            {claimed && claimedAt
              ? `Claimed ${claimedAt}`
              : earnedAt
                ? `Earned ${earnedAt}`
                : `Pays out ${rewardValue}`}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`${styles.control} ${claimable ? styles.controlPrimary : styles.controlGhost}`}
          disabled={!claimable || claiming}
          onClick={() => onClaim(reward)}
          aria-label={claimable ? `Claim ${reward.name}` : `${reward.name} is not claimable yet`}
        >
          {claiming ? (
            <>
              <Sparkles className={`size-4 ${styles.spin}`} aria-hidden="true" />
              Claiming...
            </>
          ) : claimed ? (
            <>
              <Check className="size-4" aria-hidden="true" />
              Already claimed
            </>
          ) : claimable ? (
            <>
              <Gift className="size-4" aria-hidden="true" />
              Claim reward
            </>
          ) : (
            <>
              <Lock className="size-4" aria-hidden="true" />
              {reward.requires_claim ? "Not claimable yet" : "Granted automatically"}
            </>
          )}
        </button>
        <span className="text-xs text-muted-foreground">Pays out {rewardValue}</span>
      </div>
    </article>
  );
}
