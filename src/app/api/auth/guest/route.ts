/**
 * POST /api/auth/guest — start a guest session without signup.
 *
 * The "Continue as Guest" button in `AuthPage` posts here when Firebase is not
 * configured, then stores the returned token via `AuthProvider.login()`. The
 * route was referenced by the client but never implemented, so every guest tap
 * failed with a server error and the UI showed "Could not start a guest session."
 *
 * Guests are real users in the store so preferences and history persist across
 * sessions, but they can never sign in again: they are created with a
 * `passwordHash` of null, and their email uses the RFC 2606 reserved `.invalid`
 * TLD so it can never collide with, or be delivered to, a real mailbox.
 */
import { randomUUID } from "node:crypto";
import { signToken, getSession } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GUEST_EMAIL_DOMAIN = "guest.foodguard.invalid";

function guestEmail(): string {
  return `guest-${randomUUID()}@${GUEST_EMAIL_DOMAIN}`;
}

export async function POST(request: Request): Promise<Response> {
  const meta = { requestId: "auth-guest" };

  try {
    // Idempotent: if the caller already holds a valid session (for example the
    // button was tapped twice), re-issue for that account instead of creating
    // another throwaway guest on every tap.
    const existing = await getSession(request);
    const user =
      existing ??
      (await getStore().createUser({
        email: guestEmail(),
        name: "Guest",
        passwordHash: null,
        role: "USER",
        language: "EN",
      }));

    const token = await signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      language: user.language,
    });

    logger.info("guest_session_started", { userId: user.id, reused: existing !== null });

    return Response.json({
      success: true,
      data: { token },
      error: null,
      meta,
    });
  } catch (error) {
    logger.error("guest_session_failed", {
      message: error instanceof Error ? error.message : String(error),
    });

    return Response.json(
      {
        success: false,
        data: null,
        error: { code: "GUEST_SESSION_FAILED", message: "Could not start a guest session" },
        meta,
      },
      { status: 500 },
    );
  }
}
