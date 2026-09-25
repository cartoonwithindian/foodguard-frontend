import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` throws on import, which breaks testing server-only
      // modules (e.g. barcode/node-decoder) in the node test environment.
      // Replace it with a harmless stub.
      "server-only": path.resolve(
        __dirname,
        "./src/__tests__/__fixtures__/server-only.ts",
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    // A few pipelines deliberately probe live providers (FSSAI, legal
    // metrology) and can take tens of seconds when one is rate-limiting.
    // The old 5s default failed otherwise-correct assertions on a slow network.
    testTimeout: 30_000,
    env: {
      // Ingredient research falls back to DuckDuckGo's public lite endpoint
      // when an ingredient cannot be resolved, so the "unknown ingredient"
      // path issued a real outbound request (~5s, and rate-limit dependent)
      // and blew the default timeout. No provider is reachable from CI
      // anyway, and the assertions only care that the ingredient is queued
      // for review rather than guessed.
      ENABLE_DUCKDUCKGO_SEARCH: "false",
    },
  },
});
