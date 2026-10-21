"use client";

import { useState, useCallback } from "react";
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignInButton, useClerk } from "@clerk/nextjs";

import { getAuthLabels, type AuthLabels } from "@/data/auth-labels";
import { BrandMark } from "@/components/ui/BrandMark";
import { AuthTabs, type AuthTab } from "@/components/auth/AuthTabs";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { useAuth } from "@/components/AuthProvider";
import { apiUrl } from "@/lib/network/api-url";

const LANGUAGE_STORAGE_KEY = "app-preferred-language";

function getInitialLabels(): AuthLabels {
  try {
    const stored = sessionStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored) return getAuthLabels(stored);
  } catch {
    /* sessionStorage may be unavailable */
  }
  return getAuthLabels("en");
}

export function AuthPage() {
  const [activeTab, setActiveTab] = useState<AuthTab>("login");
  const [labels] = useState<AuthLabels>(getInitialLabels);
  const router = useRouter();
  const { login, firebaseMode, clerkMode, exchangeClerkSession, continueAsGuest: continueAsGuestFirebase } = useAuth();
  const clerk = useClerk();
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState("");
  const [clerkBusy, setClerkBusy] = useState(false);
  const [clerkError, setClerkError] = useState("");

  // Sign in through Clerk, then bridge the session into a FoodGuard JWT.
  // The modal resolves asynchronously: poll briefly for the Clerk session the
  // same way the provider does, then run the exchange.
  const handleClerkSuccess = useCallback(async () => {
    setClerkBusy(true);
    setClerkError("");
    try {
      let session = clerk.session;
      for (let waited = 0; !session && waited < 15_000; waited += 500) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        session = clerk.session;
      }
      if (!session) {
        setClerkError("Sign-in didn't complete. Please try again.");
        return;
      }
      const exchanged = await exchangeClerkSession();
      if (!exchanged) {
        setClerkError("Signed in, but we couldn't sync your account. Please retry.");
        return;
      }
      router.push("/");
    } catch {
      setClerkError("Couldn't complete sign-in. Please try again.");
    } finally {
      setClerkBusy(false);
    }
  }, [clerk, exchangeClerkSession, router]);

  const continueAsGuest = useCallback(async () => {
    setGuestLoading(true);
    setGuestError("");
    try {
      if (firebaseMode) {
        await continueAsGuestFirebase();
        router.push("/");
        return;
      }
      const response = await fetch(apiUrl("/api/auth/guest"), { method: "POST" });
      const json = (await response.json()) as {
        success: boolean;
        data?: { token: string };
        error?: { message?: string } | null;
      };
      if (!response.ok || !json.success || !json.data?.token) {
        setGuestError(json.error?.message ?? labels.guest.error);
        return;
      }
      login(json.data.token);
      router.push("/");
    } catch {
      setGuestError(labels.guest.error);
    } finally {
      setGuestLoading(false);
    }
  }, [login, router, labels.guest.error, firebaseMode, continueAsGuestFirebase]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Mobile/tablet: full-width form */}
        {/* Desktop: branded side panel + form */}
        <div className="hidden flex-1 items-center justify-center bg-secondary/50 p-8 lg:flex">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-8 flex w-fit items-center gap-3">
              <BrandMark className="size-12" iconClassName="size-6" />
              <span className="text-2xl font-semibold tracking-tight text-foreground">
                FoodGuard
              </span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {labels.sidePanel.heading}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {labels.sidePanel.description}
            </p>
          </div>
        </div>

        <div className="h-px w-full bg-border lg:h-auto lg:w-px" />

        {/* Form side */}
        <div className="flex flex-1 flex-col items-center px-5 py-8 sm:px-6 sm:py-12 lg:max-w-lg lg:py-16">
          <div className="w-full max-w-sm">
            {/* Back link */}
            <Link
              href="/"
              className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Link>

            {/* Mobile logo (visible on mobile only) */}
            <div className="mb-6 flex items-center gap-3 sm:hidden">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
                <svg
                  viewBox="0 0 48 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-5 text-primary"
                  aria-hidden="true"
                >
                  <path
                    d="M24 8c-2.5 0-4.5 2-4.5 4.5v2.2c-6.2 1.4-10.5 7-10.5 13.3 0 7.7 6.3 14 14 14s14-6.3 14-14c0-6.3-4.3-11.9-10.5-13.3V12.5C28.5 10 26.5 8 24 8z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M20 22h8M24 18v8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="34"
                    cy="34"
                    r="7"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M38.5 38.5L42 42"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span className="text-sm font-semibold text-foreground">
                FoodGuard
              </span>
            </div>

            <AuthTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              loginLabel="Login"
              signupLabel="Sign Up"
            />

            <div className="mt-8">
              {activeTab === "login" ? (
                <LoginForm
                  labels={labels.login}
                  validationLabels={labels.validation}
                  onCreateAccount={() => setActiveTab("signup")}
                />
              ) : (
                <SignupForm
                  labels={labels.signup}
                  validationLabels={labels.validation}
                  strengthLabels={labels.passwordStrength}
                  onSignIn={() => setActiveTab("login")}
                />
              )}
            </div>

            {/* Clerk: primary third-party identity path when configured. */}
            {clerkMode && (
              <div className="mt-6">
                {/* `useSignIn`-free variant: SignInButton with a plain child
                    node keeps typing simple and opens the modal on click. */}
                <SignInButton mode="modal">
                  <button
                    type="button"
                    onClick={() => {
                      void handleClerkSuccess();
                    }}
                    disabled={clerkBusy}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover active:bg-primary-dark disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <Sparkles className="size-4" aria-hidden="true" />
                    {clerkBusy ? "Signing you in…" : "Continue with secure sign-in"}
                  </button>
                </SignInButton>
                {clerkError && (
                  <p role="alert" className="mt-3 text-center text-xs text-red-600">
                    {clerkError}
                  </p>
                )}
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Secured by Clerk
                </p>
              </div>
            )}

            {/* Guest bypass: one tap, no email/password */}
            <div className="mt-8">
              <AuthDivider text={labels.guest.orDivider} className="my-5" />
              <div className="rounded-2xl border border-dashed border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15">
                    <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {labels.guest.heading}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {labels.guest.note}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={continueAsGuest}
                  disabled={guestLoading}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-6 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary/10 active:bg-primary/15 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {guestLoading ? labels.guest.loading : labels.guest.button}
                </button>
                {guestError && (
                  <p role="alert" className="mt-3 text-center text-xs text-red-600">
                    {guestError}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
