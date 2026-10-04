"use client";

import { useState, useCallback } from "react";
import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";

import type { AuthLabels } from "@/data/auth-labels";
import { validateLoginForm, type ValidationErrors } from "@/lib/validation";
import { useAuth } from "@/components/AuthProvider";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { SocialLoginButton } from "@/components/auth/SocialLoginButton";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import { apiUrl } from "@/lib/network/api-url";
import { getLocalTimezone } from "@/services/gamification.service";

type LoginFormProps = {
  labels: AuthLabels["login"];
  validationLabels: AuthLabels["validation"];
  onCreateAccount: () => void;
};

export function LoginForm({
  labels,
  validationLabels,
  onCreateAccount,
}: LoginFormProps) {
  const router = useRouter();
  const { login, firebaseMode, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [note, setNote] = useState("");

  const handleEmailBlur = useCallback(() => {
    if (!email.trim()) {
      setErrors((prev) => ({ ...prev, email: validationLabels.emailRequired }));
    } else {
      setErrors((prev) => ({ ...prev, email: undefined }));
    }
  }, [email, validationLabels]);

  const handlePasswordBlur = useCallback(() => {
    if (!password) {
      setErrors((prev) => ({
        ...prev,
        password: validationLabels.passwordRequired,
      }));
    } else {
      setErrors((prev) => ({ ...prev, password: undefined }));
    }
  }, [password, validationLabels]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setServerError("");

      const result = validateLoginForm({ email, password });

      const resolved: ValidationErrors = {
        email:
          result.email === "REQUIRED"
            ? validationLabels.emailRequired
            : undefined,
        password:
          result.password === "REQUIRED"
            ? validationLabels.passwordRequired
            : undefined,
      };

      setErrors(resolved);

      if (Object.values(resolved).some(Boolean)) return;

      setLoading(true);
      try {
        if (firebaseMode) {
          await signIn(email.trim(), password);
          router.push("/onboarding");
          return;
        }
        const response = await fetch(apiUrl("/api/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password, timezone: getLocalTimezone() }),
        });
        const json = (await response.json()) as {
          success: boolean;
          data?: { token: string };
          error?: { message?: string } | null;
        };
        if (!response.ok || !json.success || !json.data?.token) {
          setServerError(
            json.error?.message ?? "Invalid email or password.",
          );
          return;
        }
        login(json.data.token);
        router.push("/onboarding");
      } catch {
        setServerError("Unable to reach the server. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [email, password, validationLabels, router, login, firebaseMode, signIn],
  );

  return (
    <div id="auth-form" role="tabpanel" aria-label="Login form">
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.625rem]">
          {labels.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {labels.subtitle}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthInput
          id="login-email"
          label={labels.emailLabel}
          type="email"
          placeholder={labels.emailPlaceholder}
          value={email}
          onChange={(v) => {
            setEmail(v);
            if (errors.email)
              setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          onBlur={handleEmailBlur}
          error={errors.email}
          icon={<Mail className="size-4" aria-hidden="true" />}
          autoComplete="email"
          disabled={loading}
        />

        <PasswordInput
          id="login-password"
          label={labels.passwordLabel}
          placeholder={labels.passwordPlaceholder}
          value={password}
          onChange={(v) => {
            setPassword(v);
            if (errors.password)
              setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          onBlur={handlePasswordBlur}
          error={errors.password}
          autoComplete="current-password"
          disabled={loading}
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setNote(labels.forgotPasswordNote)}
            className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {labels.forgotPassword}
          </button>
        </div>

        {note && (
          <div role="status" className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {note}
          </div>
        )}

        {serverError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:bg-primary/95 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {loading ? labels.signingIn : labels.signInButton}
        </button>
      </form>

      <AuthDivider text={labels.orDivider} className="my-6" />

      <SocialLoginButton
        label={labels.continueWithGoogle}
        icon={<GoogleIcon className="size-5" />}
        onClick={() => setNote(labels.googleNote)}
        disabled={loading}
      />

      <p className="mt-8 text-center text-sm text-muted-foreground">
        {labels.noAccount}{" "}
        <button
          type="button"
          onClick={onCreateAccount}
          className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {labels.createAccountLink}
        </button>
      </p>
    </div>
  );
}
