"use client";

import type { ReactNode } from "react";
import styles from "./Gamification.module.css";

/**
 * A dated history row. Shared by the reward and streak-protection history
 * lists so the two read the same way.
 */
export function HistoryRow({
  title,
  detail,
  meta,
  icon,
  tone = "default",
}: {
  title: string;
  detail: string;
  meta?: string;
  icon?: ReactNode;
  tone?: "default" | "muted";
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      {meta ? (
        <span
          className={`shrink-0 text-xs font-semibold ${
            tone === "muted" ? "text-muted-foreground" : "text-primary-dark"
          }`}
        >
          {meta}
        </span>
      ) : null}
    </div>
  );
}
