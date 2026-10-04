"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SecurityInfo } from "@/data/profile-data";
import type { ProfileLabels } from "@/data/profile-labels";

type SecuritySectionProps = {
  info: SecurityInfo;
  labels: ProfileLabels["security"];
};

export function SecuritySection({ info, labels }: SecuritySectionProps) {
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

      <div className="space-y-4">
        {/* Change password */}
        <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{labels.changePassword}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {info.lastPasswordChange ? `${labels.lastChanged}: ${info.lastPasswordChange}` : "Not available"}
            </p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {labels.changePassword}
          </button>
        </div>

        {/* Two-factor auth */}
        <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
          <div>
            <p className="text-sm font-medium text-foreground">{labels.twoFactor}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {info.lastPasswordChange ? (info.twoFactorEnabled ? labels.twoFactorEnabled : labels.twoFactorDisabled) : "Not available"}
            </p>
          </div>
          <div
            className={cn(
              "flex h-7 w-11 items-center rounded-full p-0.5 transition-colors",
              info.twoFactorEnabled ? "bg-primary" : "bg-muted",
            )}
          >
            <div
              className={cn(
                "size-6 rounded-full bg-white shadow-sm transition-transform",
                info.twoFactorEnabled ? "translate-x-4" : "translate-x-0",
              )}
            />
          </div>
        </div>

        {/* Active sessions */}
        <div className="rounded-xl border border-border p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{labels.activeSessions}</p>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {info.lastPasswordChange ? info.activeSessions : "—"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{labels.sessionsCount}</p>
        </div>

        {/* Linked accounts */}
        {info.linkedProviders.length > 0 && (
          <div className="rounded-xl border border-border p-3.5">
            <p className="text-sm font-medium text-foreground">{labels.linkedAccounts}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {info.linkedProviders.map((provider) => (
                <span
                  key={provider}
                  className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                >
                  {provider}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
