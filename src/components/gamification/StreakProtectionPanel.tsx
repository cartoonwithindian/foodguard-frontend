"use client";

import { ShieldCheck, ShieldPlus } from "lucide-react";
import {
  useStreakProtection,
  useStreakProtectionHistory,
} from "@/hooks/use-gamification";
import { formatCount, formatDate, formatDay, formatDateTime, pluralize } from "@/lib/gamification/format";
import { Stat } from "./Stat";
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
 * Streak protection inventory and the days it actually saved.
 *
 * Counts come from `/api/gamification/streak-protection`, the list from
 * `/api/gamification/streak-protection/history`. The client never decides that a
 * day was bridged or how many protections a user may hold.
 */
export function StreakProtectionPanel() {
  const protection = useStreakProtection();
  const history = useStreakProtectionHistory();
  const status = protection.data;
  const lastProtected = status?.last_protected ?? null;

  return (
    <section className={styles.section} aria-labelledby="gamification-protection-heading">
      <div className={styles.cardHeader}>
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          <h2
            id="gamification-protection-heading"
            className="text-base font-semibold text-foreground"
          >
            Streak protection
          </h2>
        </div>
        <GamificationRefreshButton
          onClick={() => {
            void protection.reload();
            void history.reload();
          }}
          busy={protection.isRefreshing || history.isRefreshing}
          label="Refresh protection"
        />
      </div>

      <GamificationStaleBanner
        error={protection.error ?? history.error}
        onRetry={() => {
          void protection.reload();
          void history.reload();
        }}
      />

      {protection.isInitialLoading ? (
        <GamificationLoading label="Loading streak protection..." rows={2} />
      ) : null}

      {protection.status === "error" && !status ? (
        <GamificationError error={protection.error} onRetry={() => void protection.reload()} />
      ) : null}

      {status ? (
        <div className={styles.stack}>
          <div className={styles.statGrid}>
            <Stat
              label="Available"
              value={`${formatCount(status.available_count)} / ${formatCount(status.max_available)}`}
            />
            <Stat label="Used" value={formatCount(status.used_count)} />
            <Stat
              label="Streak held"
              value={`${formatCount(status.current_streak)} ${pluralize(status.current_streak, "day")}`}
            />
            <Stat
              label="Last protected"
              value={lastProtected ? (formatDay(lastProtected.protected_date) ?? "—") : "None yet"}
            />
          </div>

          {lastProtected ? (
            <p className="text-xs text-muted-foreground">
              A protection covered {formatDay(lastProtected.protected_date)}
              {formatDateTime(lastProtected.used_at)
                ? `, used on ${formatDateTime(lastProtected.used_at)}`
                : ""}
              . Reason recorded by FoodGuard: {lastProtected.reason}.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              No protection has been used. Protections are granted and spent by
              FoodGuard, never claimed by the browser.
            </p>
          )}
        </div>
      ) : null}

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className="text-sm font-semibold text-foreground">Protection history</h3>
        </div>

        {history.isInitialLoading ? <GamificationLoading label="Loading history..." rows={2} /> : null}

        {history.status === "error" && !history.data ? (
          <GamificationError error={history.error} onRetry={() => void history.reload()} />
        ) : null}

        {history.data ? (
          history.data.history.length > 0 ? (
            <div>
              {history.data.history.map((usage) => (
                <HistoryRow
                  key={`${usage.protected_date}-${usage.used_at}`}
                  icon={<ShieldPlus className="size-4" aria-hidden="true" />}
                  title={formatDay(usage.protected_date) ?? usage.protected_date}
                  detail={`${usage.reason} · kept a ${usage.streak_after} ${pluralize(usage.streak_after, "day")} streak`}
                  meta={formatDate(usage.used_at) ?? undefined}
                />
              ))}
            </div>
          ) : (
            <GamificationEmpty
              title="No protection used yet"
              description="Days a streak protection saved will be listed here."
            />
          )
        ) : null}
      </div>
    </section>
  );
}
