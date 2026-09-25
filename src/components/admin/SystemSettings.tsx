"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SystemSetting } from "@/data/admin-data";
import type { AdminLabels } from "@/data/admin-labels";

type SystemSettingsProps = {
  settings: SystemSetting[];
  labels: AdminLabels["systemSettings"];
};

type CategoryKey = "assessment" | "product" | "evidence" | "ai" | "localization";

const CATEGORY_LABELS: Record<CategoryKey, keyof AdminLabels["systemSettings"]> = {
  assessment: "assessmentConfig",
  product: "productData",
  evidence: "evidence",
  ai: "ai",
  localization: "localization",
};

export function SystemSettings({ settings, labels }: SystemSettingsProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("assessment");
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);

  const categories = Object.keys(CATEGORY_LABELS) as CategoryKey[];
  const filtered = localSettings.filter((s) => s.category === activeCategory);

  const handleValueChange = (key: string, value: string | number | boolean) => {
    setLocalSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value } : s)),
    );
    setHasChanges(true);
  };

  return (
    <section>
      <h2 className="mb-4 text-base font-semibold text-foreground">{labels.title}</h2>

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        {/* Category tabs */}
        <div className="flex flex-row gap-1 lg:flex-col">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activeCategory === cat
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {labels[CATEGORY_LABELS[cat]]}
            </button>
          ))}
        </div>

        {/* Settings */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="space-y-4">
            {filtered.map((setting) => (
              <div
                key={setting.key}
                className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <label className="text-sm font-medium text-foreground">
                    {setting.label}
                  </label>
                  {setting.sensitive && (
                    <p className="text-xs text-muted-foreground">
                      Sensitive — handled via secure backend
                    </p>
                  )}
                </div>
                <div className="w-full sm:w-48">
                  {setting.type === "boolean" ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleValueChange(setting.key, !setting.value)
                      }
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        setting.value ? "bg-primary" : "bg-gray-300",
                      )}
                      role="switch"
                      aria-checked={Boolean(setting.value)}
                    >
                      <span
                        className={cn(
                          "inline-block size-4 rounded-full bg-white transition-transform",
                          setting.value ? "translate-x-6" : "translate-x-1",
                        )}
                      />
                    </button>
                  ) : setting.type === "select" ? (
                    <select
                      value={String(setting.value)}
                      onChange={(e) =>
                        handleValueChange(setting.key, e.target.value)
                      }
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {setting.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={setting.type === "number" ? "number" : "text"}
                      value={String(setting.value)}
                      onChange={(e) =>
                        handleValueChange(
                          setting.key,
                          setting.type === "number"
                            ? Number(e.target.value)
                            : e.target.value,
                        )
                      }
                      disabled={setting.sensitive}
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasChanges && (
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => {
                  setLocalSettings(settings);
                  setHasChanges(false);
                }}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {labels.cancel}
              </button>
              <button
                type="button"
                onClick={() => setHasChanges(false)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {labels.applyChanges}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
