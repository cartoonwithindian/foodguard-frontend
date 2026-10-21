import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 uses the `proxy.ts` convention (the old `middleware.ts` name is
 * deprecated). This file does NOT protect routes by redirecting — pages guard
 * themselves client-side via AuthGuard, and the backend enforces authorization
 * on every API call. Clerk's middleware here only attaches the auth context so
 * `clerkMode` sessions resolve consistently.
 */

const isPublicRoute = createRouteMatcher([
  "/",
  "/login",
  "/auth",
  "/onboarding",
  "/admin(.*)",
]);

export default clerkMiddleware((auth, request: NextRequest) => {
  // Keep the response pipeline untouched for public routes; nothing to add.
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }
  return NextResponse.next();
});

export const config = {
  // Skip static assets and images, run on everything else.
  matcher: ["/((?!.*\\..*|_next).*)", "/"],
};
