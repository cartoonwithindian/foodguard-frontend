/**
 * Presentation-only formatting.
 *
 * Every number arrives from the API and is only grouped/worded here. No level,
 * reward, streak or completion value is ever derived in this file.
 */

const XP_FORMATTER = new Intl.NumberFormat("en-IN");

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return XP_FORMATTER.format(Math.trunc(value));
}

export function formatXp(value: number): string {
  return `${formatCount(value)} XP`;
}

/** `ratio` is a server-provided 0..1 value; this only turns it into a label. */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return "0%";
  const percent = Math.min(100, Math.max(0, Math.round(ratio * 100)));
  return `${percent}%`;
}

/**
 * Clamps a server ratio into a CSS width percentage. Purely presentational:
 * the eligibility and completion decisions are the backend's.
 */
export function ratioToWidthPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return "0%";
  return `${Math.min(100, Math.max(0, ratio * 100))}%`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

const DATE_LABEL = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const DATE_TIME_LABEL = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function parseInstant(value: string): Date | null {
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

export function formatDate(value: string | null): string | null {
  if (!value) return null;
  const instant = parseInstant(value);
  return instant ? DATE_LABEL.format(instant) : null;
}

export function formatDateTime(value: string | null): string | null {
  if (!value) return null;
  const instant = parseInstant(value);
  return instant ? DATE_TIME_LABEL.format(instant) : null;
}

const DAY_LABEL = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** A `YYYY-MM-DD` day the backend sent: rendered as a calendar day, no shifting. */
export function formatDay(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const [, year, month, date] = match;
  const instant = new Date(Date.UTC(Number(year), Number(month) - 1, Number(date), 12));
  if (Number.isNaN(instant.getTime())) return day;
  return DAY_LABEL.format(instant);
}

/**
 * Human label for a backend condition type. Purely a readable synonym for the
 * server's machine name -- it asserts nothing about the user's progress. An
 * unrecognised type falls back to spaced words rather than showing raw enum.
 */
const CONDITION_LABELS: Record<string, string> = {
  UNIQUE_PRODUCTS_SCANNED: "products scanned",
  PRODUCT_SCAN_COUNT: "product scans",
  INGREDIENT_VIEWS: "ingredient checks",
  MEANINGFUL_CHATS: "questions asked",
  UNIQUE_PRODUCT_COUNT: "products scanned",
  INGREDIENT_VIEW_COUNT: "ingredient checks",
  MEANINGFUL_CHAT_COUNT: "questions asked",
  STREAK_DAYS: "day streak",
  LONGEST_STREAK: "day streak",
  CHALLENGES_COMPLETED: "challenges completed",
  TOTAL_XP: "XP earned",
};

export function conditionLabel(conditionType: string): string {
  const known = CONDITION_LABELS[conditionType];
  if (known) return known;
  return conditionType
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .join(" ");
}
