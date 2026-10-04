"use client";

import { useState } from "react";
import { Shield, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PrivacySettings } from "@/data/profile-data";
import type { ProfileLabels } from "@/data/profile-labels";

type PrivacySectionProps = {
  initial: PrivacySettings;
  labels: ProfileLabels["privacy"];
  onSave: (settings: PrivacySettings) => void;
};

export function PrivacySection({ initial, labels, onSave }: PrivacySectionProps) {
  const [settings, setSettings] = useState<PrivacySettings>(initial);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="foodguard-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="size-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{labels.title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{labels.subtitle}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Scan history */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">{labels.scanHistory}</h3>
          <button
            type="button"
            onClick={() => setSettings((p) => ({ ...p, keepScanHistory: !p.keepScanHistory }))}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              settings.keepScanHistory
                ? "border-primary/40 bg-primary/5"
                : "border-border hover:border-border/80 hover:bg-muted/30",
            )}
          >
            <p className="text-sm font-medium text-foreground">{labels.keepHistory}</p>
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full transition-colors",
                settings.keepScanHistory
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background",
              )}
            >
              {settings.keepScanHistory && <Check className="size-3.5" aria-hidden="true" />}
            </div>
          </button>
          <button
            type="button"
            className="mt-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            {labels.clearHistory}
          </button>
        </div>

        {/* Personal data */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">{labels.personalData}</h3>
          <button
            type="button"
            className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {labels.downloadData}
          </button>
        </div>

        {/* Data usage */}
        <div className="rounded-xl border border-border p-3.5">
          <p className="text-sm font-medium text-foreground">{labels.dataUsage}</p>
          <p className="mt-1 text-xs text-muted-foreground">{labels.dataUsageDescription}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {labels.saved}
        </button>
        {saved && (
          <span className="text-sm font-medium text-green-600">{labels.saved}</span>
        )}
      </div>
    </div>
  );
}
