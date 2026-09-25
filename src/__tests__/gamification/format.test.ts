import { describe, expect, it } from "vitest";
import {
  conditionLabel,
  formatCount,
  formatDate,
  formatDateTime,
  formatDay,
  formatPercent,
  formatXp,
  pluralize,
  ratioToWidthPercent,
} from "@/lib/gamification/format";

describe("gamification formatting", () => {
  it("groups counts without changing the value", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(1234)).toBe("1,234");
    expect(formatXp(25)).toBe("25 XP");
  });

  it("never renders a non-finite number as NaN", () => {
    expect(formatCount(Number.NaN)).toBe("0");
    expect(formatPercent(Number.NaN)).toBe("0%");
    expect(ratioToWidthPercent(Number.NaN)).toBe("0%");
  });

  it("turns a server ratio into a label and a width", () => {
    expect(formatPercent(0.375)).toBe("38%");
    expect(ratioToWidthPercent(0.375)).toBe("37.5%");
  });

  it("clamps a ratio that sits outside 0..1 rather than overflowing the bar", () => {
    expect(ratioToWidthPercent(1.4)).toBe("100%");
    expect(ratioToWidthPercent(-0.2)).toBe("0%");
    expect(formatPercent(1.4)).toBe("100%");
  });

  it("pluralises counts", () => {
    expect(pluralize(0, "day")).toBe("days");
    expect(pluralize(1, "day")).toBe("day");
    expect(pluralize(3, "streak protection")).toBe("streak protections");
  });

  it("formats an instant, and passes a malformed value through untouched", () => {
    expect(formatDate("2026-09-25T10:00:00.000Z")).toBe("25 Sept 2026");
    expect(formatDateTime("2026-09-25T10:00:00.000Z")).toContain("2026");
    expect(formatDate(null)).toBeNull();
    expect(formatDate("not a date")).toBeNull();
  });

  it("formats a calendar day without shifting it across the date line", () => {
    // The backend sends a local calendar day, so it is formatted at midday UTC
    // to guarantee no timezone can roll it to the previous or next day.
    expect(formatDay("2026-09-25")).toBe("Fri, 25 Sept");
    expect(formatDay("2026-01-01")).toBe("Thu, 1 Jan");
    expect(formatDay("2026-12-31")).toBe("Thu, 31 Dec");
    expect(formatDay("nonsense")).toBe("nonsense");
  });

  it("labels known condition types and degrades on unknown ones", () => {
    expect(conditionLabel("UNIQUE_PRODUCTS_SCANNED")).toBe("products scanned");
    expect(conditionLabel("STREAK_DAYS")).toBe("day streak");
    expect(conditionLabel("TOTAL_XP")).toBe("XP earned");
    expect(conditionLabel("SOME_FUTURE_CONDITION")).toBe("some future condition");
  });
});
