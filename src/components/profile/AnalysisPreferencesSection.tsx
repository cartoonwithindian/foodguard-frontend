"use client";

import { useState } from "react";
import { Check, Sliders } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalysisPreference } from "@/data/profile-data";
import { ANALYSIS_PREFERENCE_OPTIONS } from "@/data/profile-data";
import type { ProfileLabels } from "@/data/profile-labels";

type AnalysisPreferencesSectionProps = {
  initialPrefs: AnalysisPreference[];
  labels: ProfileLabels["analysisPreferences"];
  onSave: (prefs: AnalysisPreference[]) => void;
};

export function AnalysisPreferencesSection({
  initialPrefs,
  labels,
  onSave,
}: AnalysisPreferencesSectionProps) {
  const [prefs, setPrefs] = useState<AnalysisPreference[]>(initialPrefs);
  const [saved, setSaved] = useState(false);

  const toggle = (key: string) => {
    setPrefs((prev) =>
      prev.map((p) => (p.key === key ? { ...p, enabled: !p.enabled } : p)),
    );
  };

  const handleSave = () => {
    onSave(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="foodguard-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
          <Sliders className="size-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{labels.title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{labels.subtitle}</p>
        </div>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">{labels.description}</p>

      <div className="space-y-3">
        {ANALYSIS_PREFERENCE_OPTIONS.map((opt) => {
          const isEnabled = prefs.find((p) => p.key === opt.key)?.enabled ?? false;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggle(opt.key)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isEnabled
                  ? "border-primary/40 bg-primary/5"
                  : "border-border hover:border-border/80 hover:bg-muted/30",
              )}
            >
              <p className="text-sm font-medium text-foreground">{opt.label}</p>
              <div
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full transition-colors",
                  isEnabled
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background",
                )}
              >
                {isEnabled && <Check className="size-3.5" aria-hidden="true" />}
              </div>
            </button>
          );
        })}
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
