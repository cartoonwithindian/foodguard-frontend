import type { NextConfig } from "next";
import path from "node:path";

/**
 * Where the standalone Hono backend lives. Used as an external rewrite
 * target so `/api/*` is proxied server-side and the browser only ever talks
 * to this app's own origin.
 */
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  // Keep Prisma + Redis server-side only, outside the webpack bundle.
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "ioredis",
    "bcryptjs",
    // tesseract.js resolves its worker script / core / language-data paths
    // from __dirname; bundling rewrites __dirname to the .next output dir,
    // breaking the worker with MODULE_NOT_FOUND. Keep it external so the
    // paths resolve inside node_modules at runtime.
    "tesseract.js",
    "tesseract.js-core",
  ],
  // Pin the tracing root to this project. Without it Next.js may pick an
  // unrelated lockfile in a parent directory as the workspace root, which
  // breaks output file tracing and standalone builds.
  outputFileTracingRoot: path.join(__dirname),
  // Allow HMR over the Google Cloud Shell web preview domain, plus any
  // dev origin on this VM (the cloud VM's private IP changes across
  // sessions, so the wildcard pattern keeps the phone/LAN access working).
  allowedDevOrigins: ["*.cloudshell.dev", "**.*.*"],
  // This app ships no `src/app/api` handlers; every call goes to the
  // standalone backend. Proxying `/api/*` here keeps those calls
  // same-origin, so the browser needs only this app's port. Pointing the
  // client straight at the backend (`NEXT_PUBLIC_API_URL`) instead makes the
  // browser dial the backend's host and port directly, which fails whenever
  // only this app's port is reachable — a tunnel or port-forward, a
  // CloudShell preview, or a phone testing over LAN.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
