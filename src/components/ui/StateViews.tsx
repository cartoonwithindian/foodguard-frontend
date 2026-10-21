"use client";

import { AlertTriangle, RefreshCw, Inbox, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/Button";

type ErrorStateProps = {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
};

type EmptyStateProps = {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
};

type LoadingStateProps = {
  label?: string;
  /** Render skeleton placeholder rows under the spinner label. */
  rows?: number;
  className?: string;
};

function StateShell({
  icon,
  title,
  description,
  action,
  tone,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone: "error" | "neutral";
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? `flex flex-col items-center rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-12 text-center ${className ?? ""}`
          : `flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-12 text-center ${className ?? ""}`
      }
    >
      <div
        className={
          tone === "error"
            ? "flex size-14 items-center justify-center rounded-2xl bg-destructive/10"
            : "flex size-14 items-center justify-center rounded-2xl bg-muted"
        }
      >
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/**
 * Shared error state. Raw error details (HTTP codes, stack traces) are logged
 * by the network layer — the user only ever sees an intentional message.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this information. Please try again.",
  retryLabel = "Try again",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <StateShell
      tone="error"
      className={className}
      icon={<AlertTriangle className="size-7 text-destructive" aria-hidden="true" />}
      title={title}
      description={description}
      action={
        onRetry ? (
          <Button variant="primary" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {retryLabel}
          </Button>
        ) : undefined
      }
    />
  );
}

/** Shared empty state with a real action (never a dead end). */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className,
}: EmptyStateProps) {
  const action = actionLabel ? (
    actionHref ? (
      <Link href={actionHref} className={buttonClasses("primary", "md")}>
        {actionLabel}
      </Link>
    ) : (
      <Button variant="primary" onClick={onAction}>
        {actionLabel}
      </Button>
    )
  ) : undefined;

  return (
    <StateShell
      tone="neutral"
      className={className}
      icon={<Icon className="size-7 text-muted-foreground" aria-hidden="true" />}
      title={title}
      description={description}
      action={action}
    />
  );
}

/** Shared loading state: label + optional skeleton rows. */
export function LoadingState({ label = "Loading…", rows = 3, className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col gap-4 rounded-2xl border border-border bg-card px-6 py-8 ${className ?? ""}`}
    >
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="flex flex-col gap-3" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="h-3 rounded-full bg-muted"
            style={{ width: `${100 - index * 12}%` }}
          />
        ))}
      </div>
    </div>
  );
}
