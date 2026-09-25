/**
 * At-most-once celebration bookkeeping.
 *
 * A level-up or achievement unlock is an *event*, not a piece of state: the
 * backend reports it once, on the read that crossed the boundary. Two things
 * can otherwise replay it -- a re-render, or a remount that refetches. So the
 * "have I already celebrated this?" decision lives here, in a plain object
 * owned by the store, keyed by the server's own event identity
 * (`achievement_id` + `unlocked_at`, or `from -> to` at `total_xp`). It is not a
 * component lifecycle flag, and it survives remounts and reloads within the
 * tab session.
 */

export type CelebrationKind = "level-up" | "achievement";

export type LevelUpCelebration = {
  kind: "level-up";
  /** Stable event key: from_level -> to_level at total_xp. */
  id: string;
  fromLevel: number;
  toLevel: number;
  totalXp: number;
  /** The server's post-transition level state, rendered verbatim. */
  level: import("./types").LevelView | null;
};

export type AchievementCelebration = {
  kind: "achievement";
  /** Stable event key: the achievement id. */
  id: string;
  achievement: import("./types").AchievementView;
};

export type GamificationCelebration = LevelUpCelebration | AchievementCelebration;

export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const STORAGE_KEY = "foodguard:gamification-celebrations";
/** Bounded so a long session cannot grow sessionStorage without limit. */
const MAX_REMEMBERED_KEYS = 200;

function sessionStorageOrNull(): KeyValueStorage | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.sessionStorage;
    if (!storage) return null;
    return storage;
  } catch {
    // Blocked by browser privacy settings: fall back to in-memory dedup only.
    return null;
  }
}

export function levelUpEventId(fromLevel: number, toLevel: number, totalXp: number): string {
  return `level-up:${fromLevel}->${toLevel}@${totalXp}`;
}

/**
 * An achievement unlocks at most once per user, ever, so its id alone is a
 * sound event key. It is deliberately not keyed on `unlocked_at`: a sighting
 * without a timestamp would otherwise produce a second, distinct key and let
 * the same unlock be celebrated twice.
 */
export function achievementEventId(achievementId: string): string {
  return `achievement:${achievementId}`;
}

export class CelebrationLedger {
  private readonly storage: KeyValueStorage | null;
  private readonly seen = new Set<string>();
  private loaded = false;

  constructor(storage: KeyValueStorage | null = sessionStorageOrNull()) {
    this.storage = storage;
  }

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (typeof entry === "string") this.seen.add(entry);
        }
      }
    } catch {
      // Unreadable or corrupt: start from an empty ledger rather than throwing
      // inside a render path. Worst case an old event is celebrated again.
      this.seen.clear();
    }
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      const keys = Array.from(this.seen).slice(-MAX_REMEMBERED_KEYS);
      this.storage.setItem(STORAGE_KEY, JSON.stringify(keys));
    } catch {
      // Quota or privacy error: in-memory dedup still holds for this mount.
    }
  }

  has(id: string): boolean {
    this.load();
    return this.seen.has(id);
  }

  /**
   * Records an event and returns the celebration to show, or `null` when this
   * exact event has already been celebrated. Callers must render whatever comes
   * back without deciding anything further.
   */
  admit(celebration: GamificationCelebration): GamificationCelebration | null {
    this.load();
    if (this.seen.has(celebration.id)) return null;
    this.seen.add(celebration.id);
    this.persist();
    return celebration;
  }

  /** Forgets every remembered event. Exposed for the provider's "replay" control. */
  reset(): void {
    this.loaded = true;
    this.seen.clear();
    try {
      this.storage?.setItem(STORAGE_KEY, "[]");
    } catch {
      // Ignore: the in-memory set is already cleared.
    }
  }
}
