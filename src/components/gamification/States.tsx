"use client";

import { AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { GamificationApiError } from "@/lib/gamification/api";
import { useGamificationState, useRefreshGamification } from "@/hooks/use-gamification";
import styles from "./Gamification.module.css";

/**
 * The three states every gamification panel can be in.
 *
 * A panel never invents a number to fill a gap: with no response it says so and
 * offers a retry, which is the only honest thing to render.
 */

export function GamificationLoading({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div className={styles.card} aria-live="polite" aria-busy="true">
      <div className={styles.stateRow}>
        <RefreshCw className={`size-4 text-primary ${styles.spin}`} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className={styles.stack} aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className={styles.skeleton}
            style={{ width: `${100 - index * 12}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function errorHeadline(error: GamificationApiError | null): string {
  if (!error) return "Something went wrong.";
  if (error.isUnauthorized) return "Your session has expired.";
  if (error.status === 0) return "We could not reach FoodGuard.";
  return "Unable to load this right now.";
}

function errorDetail(error: GamificationApiError | null): string {
  if (!error) return "Please try again.";
  if (error.isUnauthorized) return "Sign in again to see your progress.";
  return error.message || "Please try again.";
}

export function GamificationError({
  error,
  onRetry,
  retrying = false,
}: {
  error: GamificationApiError | null;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className={`${styles.card} ${styles.bannerError}`} role="alert">
      <div className={styles.stateRow}>
        <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
        <span className="font-semibold text-foreground">{errorHeadline(error)}</span>
      </div>
      <p className="text-sm text-muted-foreground">{errorDetail(error)}</p>
      {onRetry ? (
        <div>
          <button
            type="button"
            className={`${styles.control} ${styles.controlPrimary}`}
            onClick={onRetry}
            disabled={retrying}
          >
            <RefreshCw className={`size-4 ${retrying ? styles.spin : ""}`} aria-hidden="true" />
            {retrying ? "Retrying..." : "Try again"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A failed refresh over data that is already on screen. The real numbers stay
 * visible; the problem is reported next to them.
 */
export function GamificationStaleBanner({
  error,
  onRetry,
}: {
  error: GamificationApiError | null;
  onRetry: () => void;
}) {
  if (!error) return null;
  return (
    <div className={`${styles.banner} ${styles.bannerNotice}`} role="status">
      <ShieldAlert className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 text-muted-foreground">
        {error.isUnauthorized
          ? "Sign in again to refresh your progress."
          : "Could not refresh just now — showing your last saved progress."}
      </span>
      <button type="button" className={`${styles.control} ${styles.controlGhost}`} onClick={onRetry}>
        <RefreshCw className="size-4" aria-hidden="true" />
        Refresh
      </button>
    </div>
  );
}

export function GamificationEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

export function GamificationRefreshButton({
  onClick,
  busy,
  label = "Refresh",
}: {
  onClick: () => void;
  busy: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.control} ${styles.controlGhost}`}
      onClick={onClick}
      disabled={busy}
      aria-label={busy ? `${label} in progress` : label}
    >
      <RefreshCw className={`size-4 ${busy ? styles.spin : ""}`} aria-hidden="true" />
      {label}
    </button>
  );
}

/**
 * Refreshes every slice the section screens load, and reflects whether any of
 * them is currently in flight -- so the button never claims to be idle while a
 * request is running.
 */
export function AllSectionsRefreshButton({ label = "Refresh all" }: { label?: string }) {
  const state = useGamificationState();
  const refresh = useRefreshGamification();
  // Exactly the slices `refresh()` with no arguments reloads, so the button is
  // busy if and only if one of those requests is in flight.
  const busy =
    state.overview.status === "loading" ||
    state.achievements.all.status === "loading" ||
    state.challenges.status === "loading" ||
    state.rewards.status === "loading" ||
    state.protection.status === "loading";

  return <GamificationRefreshButton onClick={() => void refresh()} busy={busy} label={label} />;
}
