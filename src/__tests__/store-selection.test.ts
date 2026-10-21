import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `getStore()` used to reach its `throw` branch in production.
 *
 * The old ordering only entered the SQLite branch when `DATABASE_URL` was
 * *unset*. A production deployment always sets `DATABASE_URL`, so SQLite was
 * skipped, the `NODE_ENV === "test"` branch did not apply, and the function
 * threw "Product database is not configured" — taking down every route backed
 * by this store (preferences, guest auth, catalog, chat tools).
 *
 * These tests pin the selection order for all four outcomes.
 */

const ORIGINAL_ENV = { ...process.env };

type Store = { kind: string };

/** `process.env.NODE_ENV` is typed read-only, so writes need a cast. */
function setNodeEnv(value: string): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

/**
 * Imports a fresh copy of `@/lib/store` with the store implementations stubbed.
 * `vi.resetModules()` clears the memoised singleton so `config` and
 * `SQLITE_DB_PATH` are re-read from the environment we just set.
 */
async function loadStore(): Promise<() => unknown> {
  vi.resetModules();
  vi.doMock("@/lib/store/prisma", () => ({ PrismaStore: class { kind = "prisma"; } }));
  vi.doMock("@/lib/store/memory", () => ({ InMemoryStore: class { kind = "memory"; } }));
  vi.doMock("@/lib/store/sqlite", () => ({
    SqliteStore: class { kind = "sqlite"; },
    SQLITE_DB_PATH: process.env.FOODGUARD_DB_PATH ?? "",
    hasSqliteDatabase: () => (process.env.FOODGUARD_DB_PATH ?? "") === "present",
  }));
  const mod = await import("@/lib/store");
  return mod.getStore;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.doUnmock("@/lib/store/prisma");
  vi.doUnmock("@/lib/store/memory");
  vi.doUnmock("@/lib/store/sqlite");
  vi.resetModules();
});

describe("store selection", () => {
  it("uses the in-memory fixtures under NODE_ENV=test", async () => {
    setNodeEnv("test");
    const getStore = await loadStore();
    expect((getStore() as Store).kind).toBe("memory");
  });

  it("uses Prisma when DATABASE_URL is set in production", async () => {
    setNodeEnv("production");
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/foodguard";
    const getStore = await loadStore();
    // The regression: this threw "Product database is not configured" before.
    expect((getStore() as Store).kind).toBe("prisma");
  });

  it("prefers Prisma over SQLite when both are configured", async () => {
    setNodeEnv("production");
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/foodguard";
    process.env.FOODGUARD_DB_PATH = "present";
    const getStore = await loadStore();
    expect((getStore() as Store).kind).toBe("prisma");
  });

  it("falls back to SQLite when no DATABASE_URL is set", async () => {
    setNodeEnv("production");
    process.env.FOODGUARD_DB_PATH = "present";
    const getStore = await loadStore();
    expect((getStore() as Store).kind).toBe("sqlite");
  });

  it("still throws in production when no database is configured at all", async () => {
    setNodeEnv("production");
    process.env.DATABASE_URL = "";
    process.env.FOODGUARD_DB_PATH = "";
    const getStore = await loadStore();
    expect(() => getStore()).toThrow(/Product database is not configured/);
  });

  it("memoises the instance instead of rebuilding it", async () => {
    setNodeEnv("test");
    const getStore = await loadStore();
    expect(getStore()).toBe(getStore());
  });
});