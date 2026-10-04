"use client";

import { useState } from "react";
import { Target, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserGoal, GoalSubPreference } from "@/data/profile-data";
import { GOAL_OPTIONS, GOAL_SUB_PREFERENCES } from "@/data/profile-data";
import type { ProfileLabels } from "@/data/profile-labels";

type GoalsSectionProps = {
  initialGoal: UserGoal;
  initialPrefs: GoalSubPreference[];
  labels: ProfileLabels["goals"];
  onSave: (goal: UserGoal, prefs: GoalSubPreference[]) => void;
};

export function GoalsSection({ initialGoal, initialPrefs, labels, onSave }: GoalsSectionProps) {
  const [selectedGoal, setSelectedGoal] = useState<UserGoal>(initialGoal);
  const [prefs, setPrefs] = useState<GoalSubPreference[]>(initialPrefs);
  const [saved, setSaved] = useState(false);

  const subOptions = selectedGoal && selectedGoal !== null ? GOAL_SUB_PREFERENCES[selectedGoal] ?? [] : [];

  const handleTogglePref = (key: string) => {
    setPrefs((prev) =>
      prev.map((p) => (p.key === key ? { ...p, enabled: !p.enabled } : p)),
    );
  };

  const handleSave = () => {
    onSave(selectedGoal ?? null, prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="foodguard-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
          <Target className="size-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{labels.title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{labels.subtitle}</p>
        </div>
      </div>

      {/* Goal selection */}
      <div className="mb-4 flex flex-wrap gap-2">
        {GOAL_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => {
              setSelectedGoal(opt.key);
              if (opt.key !== selectedGoal && opt.key !== null) {
                const newSubs = GOAL_SUB_PREFERENCES[opt.key] ?? [];
                setPrefs(newSubs.map((s: { key: string; label: string }) => ({ ...s, enabled: false })));
              }
            }}
            className={cn(
              "rounded-full border px-3.5 py-2 text-sm font-medium transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              selectedGoal === opt.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-foreground hover:border-primary/30 hover:bg-muted/50",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Goal description */}
      {selectedGoal && (
        <p className="mb-4 text-xs text-muted-foreground">
          {GOAL_OPTIONS.find((o) => o.key === selectedGoal)?.description}
        </p>
      )}

      {/* Sub-preferences */}
      {subOptions.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-foreground">Related preferences</p>
          <div className="flex flex-wrap gap-2">
            {subOptions.map((opt) => {
              const isEnabled = prefs.find((p) => p.key === opt.key)?.enabled ?? false;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleTogglePref(opt.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isEnabled
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30",
                  )}
                >
                  {isEnabled && <Check className="size-3" aria-hidden="true" />}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {labels.saveButton}
        </button>
        {saved && (
          <span className="text-sm font-medium text-green-600">{labels.saved}</span>
        )}
      </div>
    </div>
  );
}
