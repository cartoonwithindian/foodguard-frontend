import type { DataStore } from "./types";
import { InMemoryStore } from "./memory";
import { PrismaStore } from "./prisma";
import { SqliteStore, hasSqliteDatabase, SQLITE_DB_PATH } from "./sqlite";
import { isMockMode, config } from "@/lib/config";
import { logger } from "@/lib/logger";

let instance: DataStore | null = null;

/** Path to the bundled FoodGuard SQLite database, when configured. */
function sqlitePath(): string {
  return SQLITE_DB_PATH || "";
}

/**
 * Returns the active data store.
 *  - PRODUCTION (DATABASE_URL set): PostgreSQL via Prisma
 *  - SQLite (FOODGUARD_DB_PATH set, file exists): bundled FoodGuard SQLite DB
 *  - In-memory fixtures are available only to tests.
 *
 * `DATABASE_URL` is checked before SQLite on purpose: the previous ordering
 * only reached the SQLite branch when `DATABASE_URL` was *unset*, so a
 * production deployment (which always sets `DATABASE_URL`) skipped SQLite,
 * missed the test branch because `NODE_ENV` is `production`, and fell through
 * to `throw`. Every route backed by this store — preferences, guest auth, the
 * catalog and the chat tools — returned 500 in production.
 */
export function getStore(): DataStore {
  if (instance) return instance;
  if (process.env.NODE_ENV === "test") {
    logger.info("test_fixture_store_active");
    instance = new InMemoryStore();
  } else if (config.databaseUrl) {
    // `PrismaStore` keeps its own client behind a lazy proxy, so importing the
    // module here does not open a connection or load the query engine.
    instance = new PrismaStore();
  } else {
    const path = sqlitePath();
    if (path && hasSqliteDatabase(path)) {
      logger.info("sqlite_store_active", { path });
      instance = new SqliteStore(path);
    } else {
      throw new Error(
        "Product database is not configured. Set DATABASE_URL or FOODGUARD_DB_PATH to a real local database.",
      );
    }
  }
  return instance;
}

export async function ensureDemoUsers(): Promise<void> {
  if (!isMockMode() && config.seed.enabled) {
    try {
      // Lazy-load Prisma client
      
      const { prisma } = require("./prisma");
      const existing = await prisma.user.count();
      if (existing === 0) {
        const { hashPassword } = await import("@/lib/auth");
        const admin = await prisma.user.create({
          data: {
            email: config.seed.adminEmail,
            name: "FoodGaurd Admin",
            passwordHash: await hashPassword(config.seed.adminPassword),
            role: "ADMIN",
          },
        });
        await prisma.user.create({
          data: {
            email: config.seed.userEmail,
            name: "Demo User",
            passwordHash: await hashPassword(config.seed.userPassword),
            role: "USER",
          },
        });
        logger.info("demo_users_created", { adminId: admin.id });
      }
    } catch (error) {
      logger.warn("demo_users_creation_skipped", { error: String(error) });
    }
  }
}
