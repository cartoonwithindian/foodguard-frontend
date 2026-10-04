"use client";

import { useState, useCallback } from "react";
import { User, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

import type { AuthLabels } from "@/data/auth-labels";
import { validateSignupForm, getPasswordStrength, type ValidationErrors } from "@/lib/validation";
import { useAuth } from "@/components/AuthProvider";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrength";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { SocialLoginButton } from "@/components/auth/SocialLoginButton";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import { apiUrl } from "@/lib/network/api-url";
import { getLocalTimezone } from "@/services/gamification.service";

type SignupFormProps = {
  labels: AuthLabels["signup"];
  validationLabels: AuthLabels["validation"];
  strengthLabels: AuthLabels["passwordStrength"];
  onSignIn: () => void;
};

export function SignupForm({
  labels,
  validationLabels,
  strengthLabels,
  onSignIn,
}: SignupFormProps) {
  const router = useRouter();
  const { login, firebaseMode, signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [note, setNote] = useState("");

  const strength = getPasswordStrength(password);
  const strengthLabel =
    strength === "weak"
      ? strengthLabels.weak
      : strength === "medium"
        ? strengthLabels.medium
        : strengthLabels.strong;

  const resolveError = (key: string | undefined): string | undefined => {
    if (!key) return undefined;
    switch (key) {
      case "REQUIRED":
        return undefined;
      case "INVALID":
        return validationLabels.emailInvalid;
      case "MIN_LENGTH":
        return validationLabels.passwordMinLength;
      case "MISMATCH":
        return validationLabels.passwordMismatch;
      default:
        return key;
    }
  };

  const clearFieldError = useCallback((field: keyof ValidationErrors) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setServerError("");

      const validationErrors = validateSignupForm({
        name,
        email,
        password,
        confirmPassword,
      });

      const resolvedErrors: ValidationErrors = {
        name:
          validationErrors.name === "REQUIRED"
            ? validationLabels.nameRequired
            : undefined,
        email:
          validationErrors.email === "REQUIRED"
            ? validationLabels.emailRequired
            : validationErrors.email === "INVALID"
              ? validationLabels.emailInvalid
              : undefined,
        password:
          validationErrors.password === "REQUIRED"
            ? validationLabels.passwordRequired
            : validationErrors.password === "MIN_LENGTH"
              ? validationLabels.passwordMinLength
              : undefined,
        confirmPassword:
          validationErrors.confirmPassword === "REQUIRED"
            ? validationLabels.confirmPasswordRequired
            : validationErrors.confirmPassword === "MISMATCH"
              ? validationLabels.passwordMismatch
              : undefined,
      };

      setErrors(resolvedErrors);

      if (Object.values(resolvedErrors).some(Boolean)) return;

      setLoading(true);
      try {
        if (firebaseMode) {
          await signUp(email.trim(), password);
          router.push("/onboarding");
          return;
        }
        const response = await fetch(apiUrl("/api/auth/signup"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
             timezone: getLocalTimezone(),
            password,
          }),
        });
        const json = (await response.json()) as {
          success: boolean;
          data?: { token: string };
          error?: { message?: string } | null;
        };
        if (!response.ok || !json.success || !json.data?.token) {
          setServerError(
            json.error?.message ?? "Unable to create your account.",
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
    [name, email, password, confirmPassword, validationLabels, router, login, firebaseMode, signUp],
  );

  return (
    <div id="auth-form" role="tabpanel" aria-label="Signup form">
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
          id="signup-name"
          label={labels.fullNameLabel}
          type="text"
          placeholder={labels.fullNamePlaceholder}
          value={name}
          onChange={(v) => {
            setName(v);
            clearFieldError("name");
          }}
          onBlur={() => {
            if (!name.trim()) setErrors((prev) => ({ ...prev, name: validationLabels.nameRequired }));
          }}
          error={resolveError(errors.name)}
          icon={<User className="size-4" aria-hidden="true" />}
          autoComplete="name"
          disabled={loading}
        />

        <AuthInput
          id="signup-email"
          label={labels.emailLabel}
          type="email"
          placeholder={labels.emailPlaceholder}
          value={email}
          onChange={(v) => {
            setEmail(v);
            clearFieldError("email");
          }}
          onBlur={() => {
            if (!email.trim()) {
              setErrors((prev) => ({ ...prev, email: validationLabels.emailRequired }));
            }
          }}
          error={resolveError(errors.email)}
          icon={<Mail className="size-4" aria-hidden="true" />}
          autoComplete="email"
          disabled={loading}
        />

        <div className="space-y-2">
          <PasswordInput
            id="signup-password"
            label={labels.passwordLabel}
            placeholder={labels.passwordPlaceholder}
            value={password}
            onChange={(v) => {
              setPassword(v);
              clearFieldError("password");
            }}
            onBlur={() => {
              if (!password) {
                setErrors((prev) => ({ ...prev, password: validationLabels.passwordRequired }));
              } else if (password.length < 8) {
                setErrors((prev) => ({ ...prev, password: validationLabels.passwordMinLength }));
              }
            }}
            error={resolveError(errors.password)}
            autoComplete="new-password"
            disabled={loading}
          />
          {password && (
            <PasswordStrengthIndicator
              strength={strength}
              label={strengthLabel}
            />
          )}
        </div>

        <PasswordInput
          id="signup-confirm-password"
          label={labels.confirmPasswordLabel}
          placeholder={labels.confirmPasswordPlaceholder}
          value={confirmPassword}
          onChange={(v) => {
            setConfirmPassword(v);
            clearFieldError("confirmPassword");
          }}
          onBlur={() => {
            if (!confirmPassword) {
              setErrors((prev) => ({ ...prev, confirmPassword: validationLabels.confirmPasswordRequired }));
            } else if (password !== confirmPassword) {
              setErrors((prev) => ({ ...prev, confirmPassword: validationLabels.passwordMismatch }));
            }
          }}
          error={resolveError(errors.confirmPassword)}
          autoComplete="new-password"
          disabled={loading}
        />

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
          {loading ? labels.creatingAccount : labels.createAccountButton}
        </button>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {labels.termsPrefix}
          <a
            href="#"
            className="font-medium text-primary hover:underline"
            onClick={(e) => e.preventDefault()}
          >
            {labels.termsLink}
          </a>
          {labels.andLink}
          <a
            href="#"
            className="font-medium text-primary hover:underline"
            onClick={(e) => e.preventDefault()}
          >
            {labels.privacyLink}
          </a>
          .
        </p>
      </form>

      <AuthDivider text={labels.orDivider} className="my-6" />

      <SocialLoginButton
        label={labels.continueWithGoogle}
        icon={<GoogleIcon className="size-5" />}
        onClick={() => setNote(labels.googleNote)}
        disabled={loading}
      />

      {note && (
        <div role="status" className="mt-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {note}
        </div>
      )}

      <p className="mt-8 text-center text-sm text-muted-foreground">
        {labels.hasAccount}{" "}
        <button
          type="button"
          onClick={onSignIn}
          className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {labels.signInLink}
        </button>
      </p>
    </div>
  );
}
