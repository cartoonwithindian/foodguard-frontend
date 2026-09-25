import { describe, expect, it } from "vitest";
import { GamificationApiError } from "@/lib/gamification/api";
import { CelebrationLedger, type KeyValueStorage } from "@/lib/gamification/celebrations";
import { GamificationStore, ALL_SLICES } from "@/lib/gamification/store";
import type { AchievementsResponse } from "@/lib/gamification/types";
import {
  achievementView,
  achievementsResponse,
  activityResponse,
  claimResponse,
  levelView,
  overviewResponse,
  rewardView,
  stubApi,
} from "./fixtures";

function memoryStorage(): KeyValueStorage {
  const dump = new Map<string, string>();
  return {
    getItem: (key) => dump.get(key) ?? null,
    setItem: (key, value) => {
      dump.set(key, value);
    },
  };
}

function makeStore(api = stubApi(), storage: KeyValueStorage = memoryStorage()) {
  return new GamificationStore({ api, ledger: new CelebrationLedger(storage) });
}

describe("gamification store", () => {
  it("exposes loading, loaded and error states per slice", async () => {
    const store = makeStore();

    expect(store.getState().overview.status).toBe("idle");

    const pending = store.load("overview");
    expect(store.getState().overview.status).toBe("loading");
    await pending;

    expect(store.getState().overview.status).toBe("loaded");
    expect(store.getState().overview.data).toEqual(overviewResponse());
  });

  it("shares one request between concurrent callers for the same slice", async () => {
    const api = stubApi();
    const store = makeStore(api);

    await Promise.all([store.load("overview"), store.load("overview"), store.load("overview")]);

    expect(api.calls.filter((call) => call === "overview")).toHaveLength(1);
  });

  it("does not refetch a loaded slice unless a refresh is asked for", async () => {
    const api = stubApi();
    const store = makeStore(api);

    await store.load("overview");
    await store.ensureLoaded(ALL_SLICES);
    expect(api.calls.filter((call) => call === "overview")).toHaveLength(1);

    await store.refresh(["overview"]);
    expect(api.calls.filter((call) => call === "overview")).toHaveLength(2);
  });

  it("records an error and no data when the first load fails", async () => {
    const failing = new GamificationStore({
      api: {
        ...stubApi(),
        getRewards: async () => {
          throw new GamificationApiError("Network down", 0, null);
        },
      },
    });

    await failing.load("rewards");

    const slice = failing.getState().rewards;
    expect(slice.status).toBe("error");
    expect(slice.data).toBeNull();
    expect(slice.error?.isRetryable).toBe(true);
  });

  it("keeps the last good data when a refresh fails, and reports the error", async () => {
    let fail = false;
    const api = {
      ...stubApi(),
      getOverview: async () => {
        if (fail) throw new GamificationApiError("Gateway timeout", 504, null);
        return overviewResponse();
      },
    };
    const store = makeStore(api as never);

    await store.load("overview");
    fail = true;
    await store.refresh(["overview"]);

    const slice = store.getState().overview;
    expect(slice.status).toBe("loaded");
    expect(slice.data).not.toBeNull();
    expect(slice.error?.status).toBe(504);
  });

  it("keeps a separate slice per achievement filter", async () => {
    const api = stubApi({
      achievements: (filter) =>
        achievementsResponse({
          filter: filter as AchievementsResponse["filter"],
          unlocked: filter === "unlocked" ? 1 : 0,
          achievements: filter === "locked" ? [] : [achievementView()],
        }),
    });
    const store = makeStore(api);

    await store.load("achievementsAll");
    await store.load("achievementsLocked");

    const achievements = store.getState().achievements;
    expect(achievements.all.status).toBe("loaded");
    expect(achievements.locked.status).toBe("loaded");
    expect(achievements.locked.data?.achievements).toHaveLength(0);
    expect(achievements.unlocked.status).toBe("idle");
  });

  it("notifies subscribers once per state change", async () => {
    const store = makeStore();
    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });

    await store.load("overview");
    const afterLoad = notifications;
    expect(afterLoad).toBeGreaterThan(0);

    await store.refresh(["overview"]);
    expect(notifications).toBeGreaterThan(afterLoad);

    unsubscribe();
    const before = notifications;
    await store.refresh(["overview"]);
    expect(notifications).toBe(before);
  });

  it("keeps the snapshot identity stable when nothing changed", () => {
    const store = makeStore();
    const first = store.getState();
    expect(store.getState()).toBe(first);
  });

  it("re-reads a slice that was refreshed while a request was still in flight", async () => {
    let calls = 0;
    let release: () => void = () => {};
    const gated = new Promise<void>((resolve) => {
      release = resolve;
    });
    const api = {
      ...stubApi(),
      getOverview: async () => {
        calls += 1;
        if (calls === 1) await gated;
        return overviewResponse({ total_xp: calls * 10 });
      },
    };
    const store = makeStore(api as never);

    const first = store.load("overview");
    // A scan lands mid-flight: the refresh must not be dropped.
    const second = store.refresh(["overview"]);
    release();
    await Promise.all([first, second]);

    expect(calls).toBe(2);
    expect(store.getState().overview.data?.total_xp).toBe(20);
  });
});

describe("gamification store celebrations", () => {
  const levelUpResponse = () =>
    achievementsResponse({
      level: levelView({ level: 2, total_xp: 150, current_level_xp: 50, xp_to_next_level: 200, progress: 0.25 }),
      leveled_up: true,
      level_up: { from_level: 1, to_level: 2, total_xp: 150 },
      newly_unlocked: ["first_scan"],
      achievements: [achievementView({ unlocked: true, unlocked_at: "2026-09-25T10:00:00.000Z" })],
      unlocked: 1,
    });

  it("queues a level-up and an unlock once when the backend reports both", async () => {
    const store = makeStore(stubApi({ achievements: () => levelUpResponse() }));

    await store.load("achievementsAll");

    const { celebrations } = store.getState();
    expect(celebrations.map((entry) => entry.kind).sort()).toEqual(["achievement", "level-up"]);
    expect(celebrations.find((entry) => entry.kind === "level-up")?.toLevel).toBe(2);
  });

  it("does not celebrate the same event again when the slice is refetched", async () => {
    const store = makeStore(stubApi({ achievements: () => levelUpResponse() }));

    await store.load("achievementsAll");
    expect(store.getState().celebrations).toHaveLength(2);

    await store.refresh(["achievementsAll"]);
    await store.refresh(["achievementsAll"]);
    expect(store.getState().celebrations).toHaveLength(2);
  });

  it("does not replay a celebration for a remount that reuses the same storage", async () => {
    const storage = memoryStorage();
    // First mount: the backend reports the event.
    const first = makeStore(stubApi({ achievements: () => levelUpResponse() }), storage);
    await first.load("achievementsAll");
    expect(first.getState().celebrations).toHaveLength(2);

    // Remount, same tab storage: a brand new store instance, same ledger keys.
    const second = makeStore(stubApi({ achievements: () => levelUpResponse() }), storage);
    await second.load("achievementsAll");
    expect(second.getState().celebrations).toHaveLength(0);
  });

  it("never lets a filtered response drive a celebration", async () => {
    const store = makeStore(
      stubApi({
        achievements: (filter) =>
          filter === "all"
            ? achievementsResponse()
            : achievementsResponse({
                filter: filter as AchievementsResponse["filter"],
                leveled_up: true,
                level_up: { from_level: 1, to_level: 2, total_xp: 150 },
                newly_unlocked: ["first_scan"],
                achievements: [],
              }),
      }),
    );

    await store.load("achievementsUnlocked");

    // A filtered payload can name an unlock it cannot resolve into a card, so
    // it is deliberately not a celebration source.
    expect(store.getState().celebrations).toHaveLength(0);
  });

  it("skips an unlock id that has no view to show", async () => {
    const store = makeStore(
      stubApi({
        achievements: () =>
          achievementsResponse({ newly_unlocked: ["not_in_payload"], achievements: [] }),
      }),
    );

    await store.load("achievementsAll");

    expect(store.getState().celebrations).toHaveLength(0);
  });

  it("takes celebrations from a scan response and then refreshes the slices", async () => {
    const api = stubApi({
      achievements: () => achievementsResponse(),
    });
    const store = makeStore(api);
    await store.load("achievementsAll");
    api.calls.length = 0;

    await store.applyActivityResult(
      activityResponse({
        level: levelView({ level: 3, total_xp: 400 }),
        level_up: { from_level: 2, to_level: 3, total_xp: 400 },
        newly_unlocked: ["curious_mind"],
      }),
    );

    // The unlock had no loaded view, so nothing is invented for it...
    expect(store.getState().celebrations.map((entry) => entry.kind)).toEqual(["level-up"]);
    // ...and the scan still refreshes everything a scan can move.
    expect(api.calls).toEqual(
      expect.arrayContaining(["overview", "achievements:all", "challenges"]),
    );
  });

  it("celebrates an unlock carried inline by the activity response", async () => {
    const store = makeStore(stubApi());
    await store.load("achievementsAll");

    await store.applyActivityResult(
      activityResponse({
        newly_unlocked: [
          achievementView({
            achievement_id: "food_explorer",
            name: "Food Explorer",
            unlocked: true,
            unlocked_at: "2026-09-25T12:00:00.000Z",
          }),
        ],
      }),
    );

    const achievementCelebration = store
      .getState()
      .celebrations.find((entry) => entry.kind === "achievement");
    expect(achievementCelebration?.id).toBe("achievement:food_explorer");
  });

  it("does not celebrate the same event twice when the scan and the refetch both report it", async () => {
    const store = makeStore(
      stubApi({
        achievements: () =>
          achievementsResponse({
            leveled_up: true,
            level_up: { from_level: 1, to_level: 2, total_xp: 150 },
            newly_unlocked: ["first_scan"],
            achievements: [achievementView({ unlocked: true, unlocked_at: "2026-09-25T10:00:00.000Z" })],
          }),
      }),
    );
    await store.load("achievementsAll");
    const afterFirstRead = store.getState().celebrations.length;

    await store.applyActivityResult(
      activityResponse({ level_up: { from_level: 1, to_level: 2, total_xp: 150 } }),
    );

    expect(store.getState().celebrations).toHaveLength(afterFirstRead);
  });

  it("dismisses a celebration without touching the ledger", async () => {
    const store = makeStore(
      stubApi({
        achievements: () =>
          achievementsResponse({
            leveled_up: true,
            level_up: { from_level: 1, to_level: 2, total_xp: 150 },
          }),
      }),
    );
    await store.load("achievementsAll");
    expect(store.getState().celebrations).toHaveLength(1);

    store.dismissCelebration("level-up:1->2@150");
    expect(store.getState().celebrations).toHaveLength(0);

    // Dismissing is not a "replay": the event is still remembered.
    await store.refresh(["achievementsAll"]);
    expect(store.getState().celebrations).toHaveLength(0);
  });
});

describe("gamification store rewards", () => {
  it("posts the claim and merges the reward the backend returned", async () => {
    const claimed = rewardView({
      user_reward_id: "ur_1",
      earned: true,
      claimed: true,
      claimed_at: "2026-09-25T10:00:00.000Z",
      requires_claim: true,
    });
    // The backend persists the claim, so its next read already reports it.
    let persisted = rewardView({ earned: true, requires_claim: true });
    let claimArgs: unknown[] = [];
    const api = {
      ...stubApi({
        rewards: () => ({
          rewards: [persisted],
          available: persisted.claimed ? 0 : 1,
          earned: 1,
          claimed: persisted.claimed ? 1 : 0,
        }),
      }),
      claimReward: async (...args: unknown[]) => {
        claimArgs = args;
        persisted = claimed;
        return claimResponse({ reward: claimed });
      },
    };
    const store = makeStore(api as never);
    await store.load("rewards");

    await store.claimReward(rewardView({ earned: true, requires_claim: true }));

    expect(claimArgs).toEqual(["seven_day_streak_guardian", undefined]);
    expect(store.getState().rewards.data?.rewards[0].claimed).toBe(true);
    expect(store.getState().claiming.seven_day_streak_guardian).toBe("claimed");
  });

  it("surfaces a rejected claim and still re-reads the reward slices", async () => {
    const api = {
      ...stubApi(),
      claimReward: async () => {
        throw new GamificationApiError("Reward is not eligible", 409, "REWARD_NOT_ELIGIBLE");
      },
    };
    const store = makeStore(api as never);
    await store.load("rewards");
    api.calls.length = 0;

    await store.claimReward(rewardView());

    expect(store.getState().claimError?.code).toBe("REWARD_NOT_ELIGIBLE");
    expect(store.getState().claiming.seven_day_streak_guardian).toBe("failed");
    // Eligibility is re-read, never assumed.
    expect(api.calls).toEqual(
      expect.arrayContaining(["rewards", "rewardHistory", "protection", "overview"]),
    );
  });
});
