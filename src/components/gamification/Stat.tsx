"use client";

import styles from "./Gamification.module.css";

/** A labelled figure. The value is always a string the caller got from the API. */
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
