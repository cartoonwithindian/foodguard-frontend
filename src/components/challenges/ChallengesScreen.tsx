"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, History, RefreshCw, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CHALLENGES_UPDATED_EVENT,
  fetchChallenges,
  type ChallengeHistoryItem,
  type ChallengeResponse,
  type UserChallenge,
} from "@/services/challenge.service";
import { ChallengeCard } from "./ChallengeCard";

type Tab = "daily" | "weekly";

function HistoryRow({ item }: { item: ChallengeHistoryItem }) {
  const expired = item.status === "expired";
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
            expired ? "bg-muted text-muted-foreground" : "bg-primary-light text-primary-dark"
          }`}
        >
          {expired ? <History className="size-4" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
          <p className="text-xs text-muted-foreground">
            {item.period_start} · {item.progress} / {item.target}
          </p>
        </div>
      </div>
      <span className={`shrink-0 text-xs font-semibold ${expired ? "text-muted-foreground" : "text-primary-dark"}`}>
        {expired ? "Expired" : `+${item.xp_reward} XP`}
      </span>
    </div>
  );
}

export function ChallengesScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("daily");
  const [data, setData] = useState<ChallengeResponse | null>(null);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  const load = useCallback(async (signal?: AbortSignal) => {
    setState("loading");
    try {
      setData(await fetchChallenges(signal));
      setState("loaded");
    } catch {
      setData(null);
      setState("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const onUpdate = () => void load();
    window.addEventListener(CHALLENGES_UPDATED_EVENT, onUpdate);
    return () => {
      controller.abort();
      window.removeEventListener(CHALLENGES_UPDATED_EVENT, onUpdate);
    };
  }, [load]);

  const current: UserChallenge[] = data?.[tab] ?? [];

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Back to home"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
          <Target className="size-5 text-primary" aria-hidden="true" />
          <h1 className="text-base font-semibold text-foreground">Challenges</h1>
          <Link href="/" className="ml-auto text-xs font-semibold text-primary hover:text-primary-dark">
            Back to FoodGuard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="max-w-2xl">
          <p className="foodguard-eyebrow text-primary">Build informed habits</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            FoodGuard challenges
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Complete meaningful product scans, ingredient checks, and questions. Progress is recorded from real FoodGuard activity.
          </p>
        </div>

        <div className="mt-7 inline-flex rounded-xl border border-border bg-card p-1 shadow-sm" role="tablist" aria-label="Challenge period">
          {(["daily", "weekly"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold capitalize transition-colors ${
                tab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        {state === "loading" && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground" aria-live="polite">
            <RefreshCw className="size-4 animate-spin text-primary" aria-hidden="true" />
            Loading your challenges...
          </div>
        )}

        {state === "error" && (
          <div className="foodguard-card mt-6 border-red-200 bg-red-50/60 p-6" role="alert">
            <p className="text-sm font-semibold text-red-800">Unable to load your challenges.</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        )}

        {state === "loaded" && (
          <>
            <section className="mt-6 grid gap-4 lg:grid-cols-2">
              {current.length > 0 ? (
                current.map((challenge) => <ChallengeCard key={challenge.challenge_id} challenge={challenge} />)
              ) : (
                <div className="foodguard-card p-6 lg:col-span-2">
                  <p className="text-sm font-semibold text-foreground">No {tab} challenges available</p>
                  <p className="mt-1 text-sm text-muted-foreground">New challenges will appear when they are configured and enabled.</p>
                </div>
              )}
            </section>

            <section className="foodguard-card mt-6 p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <History className="size-4 text-primary" aria-hidden="true" />
                <h2 className="text-base font-semibold text-foreground">Challenge history</h2>
              </div>
              {data?.history && data.history.length > 0 ? (
                <div className="mt-3">
                  {data.history.slice(0, 12).map((item) => (
                    <HistoryRow key={`${item.challenge_id}-${item.period_start}`} item={item} />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Completed and expired challenges will appear here.</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
