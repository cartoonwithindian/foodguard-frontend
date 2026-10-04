import type { NextConfig } from "next";
import path from "node:path";

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
  // Proxy /benchmark/* to the barcode-benchmark Angular app on port 4200
  // Proxy /api/* to the Hono backend on port 3001
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:3001/api/:path*",
      },
      {
        source: "/benchmark/:path*",
        destination: "http://127.0.0.1:4200/:path*",
      },
    ];
  },
};

export default nextConfig;
