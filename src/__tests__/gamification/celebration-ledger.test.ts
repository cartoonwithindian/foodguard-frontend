import { describe, expect, it } from "vitest";
import {
  CelebrationLedger,
  achievementEventId,
  levelUpEventId,
  type KeyValueStorage,
} from "@/lib/gamification/celebrations";
import { achievementView } from "./fixtures";

/** A `sessionStorage` stand-in so the persistence path is exercised in node. */
function memoryStorage(): KeyValueStorage & { dump: Map<string, string> } {
  const dump = new Map<string, string>();
  return {
    dump,
    getItem: (key) => dump.get(key) ?? null,
    setItem: (key, value) => {
      dump.set(key, value);
    },
  };
}

describe("celebration ledger", () => {
  it("admits an achievement unlock exactly once", () => {
    const ledger = new CelebrationLedger(memoryStorage());
    const view = achievementView({ unlocked: true, unlocked_at: "2026-09-25T10:00:00.000Z" });

    const first = ledger.admit({ kind: "achievement", id: achievementEventId("first_scan"), achievement: view });
    const second = ledger.admit({ kind: "achievement", id: achievementEventId("first_scan"), achievement: view });

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("treats the same unlock as one event whether or not a timestamp is known", () => {
    const storage = memoryStorage();
    const withTimestamp = new CelebrationLedger(storage);
    const view = achievementView({ unlocked: true, unlocked_at: "2026-09-25T10:00:00.000Z" });

    // Keyed on the id alone, so a sighting without `unlocked_at` cannot produce
    // a second key for the same unlock.
    expect(achievementEventId("first_scan")).toBe(achievementEventId("first_scan"));
    expect(
      withTimestamp.admit({ kind: "achievement", id: achievementEventId("first_scan"), achievement: view }),
    ).not.toBeNull();

    // A second ledger over the same storage stands in for a remount/reload.
    const afterRemount = new CelebrationLedger(storage);
    expect(
      afterRemount.admit({ kind: "achievement", id: achievementEventId("first_scan"), achievement: view }),
    ).toBeNull();
  });

  it("admits each distinct level-up once, and never repeats it", () => {
    const ledger = new CelebrationLedger(memoryStorage());
    const first = ledger.admit({
      kind: "level-up",
      id: levelUpEventId(1, 2, 150),
      fromLevel: 1,
      toLevel: 2,
      totalXp: 150,
      level: null,
    });
    const repeat = ledger.admit({
      kind: "level-up",
      id: levelUpEventId(1, 2, 150),
      fromLevel: 1,
      toLevel: 2,
      totalXp: 150,
      level: null,
    });
    const next = ledger.admit({
      kind: "level-up",
      id: levelUpEventId(2, 3, 400),
      fromLevel: 2,
      toLevel: 3,
      totalXp: 400,
      level: null,
    });

    expect(first).not.toBeNull();
    expect(repeat).toBeNull();
    expect(next).not.toBeNull();
  });

  it("keeps a level-up and an achievement unlock in the same response independent", () => {
    const ledger = new CelebrationLedger(memoryStorage());

    const levelUp = ledger.admit({
      kind: "level-up",
      id: levelUpEventId(1, 2, 150),
      fromLevel: 1,
      toLevel: 2,
      totalXp: 150,
      level: null,
    });
    const achievement = ledger.admit({
      kind: "achievement",
      id: achievementEventId("first_scan"),
      achievement: achievementView(),
    });

    expect(levelUp).not.toBeNull();
    expect(achievement).not.toBeNull();
    expect(levelUp?.id).not.toBe(achievement?.id);
  });

  it("survives corrupt stored state instead of throwing", () => {
    const storage = memoryStorage();
    storage.setItem("foodguard:gamification-celebrations", "{not json");

    const ledger = new CelebrationLedger(storage);
    expect(ledger.has(achievementEventId("first_scan"))).toBe(false);
    expect(
      ledger.admit({ kind: "achievement", id: achievementEventId("first_scan"), achievement: achievementView() }),
    ).not.toBeNull();
  });

  it("works with no storage at all (server rendering, blocked storage)", () => {
    const ledger = new CelebrationLedger(null);
    expect(
      ledger.admit({ kind: "achievement", id: achievementEventId("first_scan"), achievement: achievementView() }),
    ).not.toBeNull();
    expect(
      ledger.admit({ kind: "achievement", id: achievementEventId("first_scan"), achievement: achievementView() }),
    ).toBeNull();
  });

  it("reset clears the remembered events so the UI can replay them", () => {
    const storage = memoryStorage();
    const ledger = new CelebrationLedger(storage);
    const view = achievementView();

    ledger.admit({ kind: "achievement", id: achievementEventId("first_scan"), achievement: view });
    ledger.reset();

    expect(
      ledger.admit({ kind: "achievement", id: achievementEventId("first_scan"), achievement: view }),
    ).not.toBeNull();
  });
});
