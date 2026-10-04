"use client";

import { useState } from "react";
import { ListPlus, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductPreference } from "@/data/profile-data";
import type { ProfileLabels } from "@/data/profile-labels";

type ProductPreferencesSectionProps = {
  initialPrefs: ProductPreference[];
  labels: ProfileLabels["productPreferences"];
  onSave: (prefs: ProductPreference[]) => void;
};

export function ProductPreferencesSection({
  initialPrefs,
  labels,
  onSave,
}: ProductPreferencesSectionProps) {
  const [prefs, setPrefs] = useState<ProductPreference[]>(initialPrefs);
  const [newType, setNewType] = useState<"avoid" | "prefer">("avoid");
  const [newValue, setNewValue] = useState("");
  const [saved, setSaved] = useState(false);

  const avoidPrefs = prefs.filter((p) => p.type === "avoid");
  const preferPrefs = prefs.filter((p) => p.type === "prefer");

  const handleAdd = () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    const newItem: ProductPreference = {
      id: `pp-${Date.now()}`,
      type: newType,
      value: trimmed,
    };
    setPrefs((prev) => [...prev, newItem]);
    setNewValue("");
  };

  const handleRemove = (id: string) => {
    setPrefs((prev) => prev.filter((p) => p.id !== id));
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
          <ListPlus className="size-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{labels.title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{labels.subtitle}</p>
        </div>
      </div>

      {/* Avoid list */}
      <div className="mb-4">
        <p className="mb-2 text-sm font-semibold text-foreground">{labels.avoidLabel}</p>
        {avoidPrefs.length === 0 ? (
          <p className="text-xs text-muted-foreground">{labels.emptyAvoid}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {avoidPrefs.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
              >
                {p.value}
                <button
                  type="button"
                  onClick={() => handleRemove(p.id)}
                  className="rounded-full p-0.5 hover:bg-red-100"
                  aria-label={`Remove ${p.value}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Prefer list */}
      <div className="mb-4">
        <p className="mb-2 text-sm font-semibold text-foreground">{labels.preferLabel}</p>
        {preferPrefs.length === 0 ? (
          <p className="text-xs text-muted-foreground">{labels.emptyPrefer}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {preferPrefs.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
              >
                {p.value}
                <button
                  type="button"
                  onClick={() => handleRemove(p.id)}
                  className="rounded-full p-0.5 hover:bg-green-100"
                  aria-label={`Remove ${p.value}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Add new */}
      <div className="flex gap-2">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setNewType("avoid")}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
              newType === "avoid"
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {labels.avoidLabel}
          </button>
          <button
            type="button"
            onClick={() => setNewType("prefer")}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
              newType === "prefer"
                ? "border-green-300 bg-green-50 text-green-700"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {labels.preferLabel}
          </button>
        </div>
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder={labels.addPlaceholder}
          className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newValue.trim()}
          className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          {labels.addButton}
        </button>
      </div>

      {/* Save */}
      <div className="mt-4 flex items-center gap-3">
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
