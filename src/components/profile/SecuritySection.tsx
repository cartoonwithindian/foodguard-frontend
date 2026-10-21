"use client";

import { Lock, ShieldCheck } from "lucide-react";
import type { ProfileLabels } from "@/data/profile-labels";

type SecuritySectionProps = {
  labels: ProfileLabels["security"];
  /** "jwt" = email/password sessions; "clerk" = Clerk-managed identity. */
  authProvider: "jwt" | "clerk" | "firebase";
};

/**
 * Security & sessions.
 *
 * This section previously rendered a fake 2FA toggle, an invented session
 * count and a dead "change password" button. None of that state exists in the
 * backend, so the section now states honestly how the account is secured and
 * offers the real action available per auth provider.
 */
/**
 * Clerk's account portal URL, derived from the publishable key at build time
 * (no hardcoded instance URL in source). Falls back to Clerk's generic
 * account page when the key cannot be decoded.
 */
function clerkAccountUrl(): string {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) return "https://account.clerk.com";
  const encoded = key.split("_")[2];
  if (!encoded) return "https://account.clerk.com";
  try {
    // The domain part is terminated by Clerk's `$` delimiter — strip it.
    const domain = Buffer.from(encoded, "base64").toString("utf8").split("$")[0].trim();
    return domain.includes(".") ? `https://${domain}` : "https://account.clerk.com";
  } catch {
    return "https://account.clerk.com";
  }
}

export function SecuritySection({ labels, authProvider }: SecuritySectionProps) {
  const providerCopy =
    authProvider === "clerk"
      ? "Your sign-in, password and two-factor settings are managed by Clerk's secure authentication dashboard."
      : authProvider === "firebase"
        ? "Your sign-in, password and two-factor settings are managed by your Google account."
        : "You sign in with an email and password. Sessions are secured with signed tokens that expire automatically.";

  return (
    <div className="foodguard-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
          <Lock className="size-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{labels.title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{labels.subtitle}</p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-muted-foreground">{providerCopy}</p>
      </div>

      {authProvider === "clerk" && (
        <a
          href={clerkAccountUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Lock className="size-4" aria-hidden="true" />
          Manage sign-in settings
        </a>
      )}
    </div>
  );
}
