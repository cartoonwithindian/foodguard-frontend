"use client";

import Link from "next/link";
import { Check, Clock3, Flame, Sparkles, Target } from "lucide-react";
import type { UserChallenge } from "@/services/challenge.service";

type ChallengeCardProps = {
  challenge: UserChallenge;
  compact?: boolean;
};

function progressPercent(challenge: UserChallenge): number {
  if (challenge.target <= 0) return 0;
  return Math.min(100, Math.round((challenge.progress / challenge.target) * 100));
}

/** The API returns the exclusive period end; show the last active day. */
function lastActiveDay(exclusiveEnd: string): string {
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(exclusiveEnd);
  if (!parsed) return exclusiveEnd;
  const [, year, month, day] = parsed;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function ChallengeCard({ challenge, compact = false }: ChallengeCardProps) {
  const percent = progressPercent(challenge);

  return (
    <article
      className={`foodguard-card flex flex-col ${compact ? "p-4" : "p-5 sm:p-6"} ${
        challenge.completed ? "border-primary/25 bg-primary-light/35" : "bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
          {challenge.completed ? <Check className="size-5" aria-hidden="true" /> : <Target className="size-5" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-foreground">{challenge.name}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary-dark">
              <Sparkles className="size-3" aria-hidden="true" />
              +{challenge.xp_reward} XP
            </span>
          </div>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{challenge.description}</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">
            {challenge.progress} / {challenge.target}
          </span>
          <span className="text-muted-foreground">
            {challenge.completed ? "Completed" : `${percent}%`}
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={challenge.progress}
          aria-valuemin={0}
          aria-valuemax={challenge.target}
          aria-label={`${challenge.name} progress`}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5" aria-hidden="true" />
          {challenge.period_start} – {lastActiveDay(challenge.period_end)}
        </span>
        {challenge.completed ? (
          <span className="inline-flex items-center gap-1 font-medium text-primary-dark">
            <Check className="size-3.5" aria-hidden="true" />
            Reward claimed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Flame className="size-3.5 text-amber-500" aria-hidden="true" />
            Keep going
          </span>
        )}
      </div>

      {compact && (
        <Link
          href="/challenges"
          className="mt-4 text-xs font-semibold text-primary transition-colors hover:text-primary-dark"
        >
          View all challenges →
        </Link>
      )}
    </article>
  );
}
