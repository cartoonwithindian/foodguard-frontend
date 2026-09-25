"use client";

import styles from "./Gamification.module.css";

export type ProgressBarProps = {
  /** Server-provided 0..1 value. The client does not compute progress itself. */
  ratio: number;
  label: string;
  /** `aria-valuenow` / `aria-valuemax`, taken from the server's own numbers. */
  value?: number;
  max?: number;
  valueText?: string;
  locked?: boolean;
};

/**
 * A real `progressbar`. Every value comes from the API response -- the width is
 * the server's `progress` / `progress_ratio` and the accessible value is the
 * server's own `progress` against `target`.
 */
export function ProgressBar({ ratio, label, value, max, valueText, locked = false }: ProgressBarProps) {
  const percent = Number.isFinite(ratio) ? Math.min(100, Math.max(0, ratio * 100)) : 0;
  // `progress` can exceed `target` once a condition is met; aria-valuenow must
  // not, or the bar reports a position outside its own scale.
  const ariaValue = value != null && max != null ? Math.min(value, max) : value;
  return (
    <div
      className={`${styles.track} ${locked ? styles.trackLocked : ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={ariaValue}
      aria-valuetext={valueText}
    >
      <div className={styles.fill} style={{ width: `${percent}%` }} />
    </div>
  );
}
