"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, RefreshCw, Target } from "lucide-react";
import Link from "next/link";
import { CHALLENGES_UPDATED_EVENT, fetchChallenges, type UserChallenge } from "@/services/challenge.service";
import { useAuth } from "@/components/AuthProvider";

export function DailyChallengePreview() {
  const { isAuthenticated } = useAuth();
  const [challenge, setChallenge] = useState<UserChallenge | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setState("idle");
      return;
    }
    setState("loading");
    try {
      const result = await fetchChallenges();
      setChallenge(result.daily[0] ?? null);
      setState("idle");
    } catch {
      setState("error");
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void load();
    const onUpdate = () => void load();
    window.addEventListener(CHALLENGES_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(CHALLENGES_UPDATED_EVENT, onUpdate);
  }, [load]);

  if (state === "loading") {
    return (
      <section className="foodguard-card p-5" aria-live="polite">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="size-4 animate-spin text-primary" aria-hidden="true" />
          Loading today's challenge...
        </div>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="foodguard-card border-red-200 bg-red-50/60 p-5" role="status">
        <p className="text-sm font-medium text-red-800">Unable to load today's challenge.</p>
        <button type="button" onClick={() => void load()} className="mt-3 text-xs font-semibold text-primary hover:text-primary-dark">
          Try again
        </button>
      </section>
    );
  }

  if (!challenge) return null;

  const percent = challenge.target > 0 ? Math.min(100, Math.round((challenge.progress / challenge.target) * 100)) : 0;

  return (
    <section className="foodguard-card border-primary/15 bg-primary-light/40 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="foodguard-eyebrow text-primary-dark">Today&apos;s challenge</p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">{challenge.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{challenge.description}</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/80 text-primary">
          <Target className="size-5" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">{challenge.progress} / {challenge.target}</span>
        <span className="font-semibold text-primary-dark">+{challenge.xp_reward} XP</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80" role="progressbar" aria-valuenow={challenge.progress} aria-valuemin={0} aria-valuemax={challenge.target} aria-label={`${challenge.name} progress`}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
      <Link href="/challenges" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark">
        View challenges
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}
