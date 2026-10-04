"use client";

import { Globe, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_LANGUAGES } from "@/data/languages";
import type { ProfileLabels } from "@/data/profile-labels";

type LanguageSectionProps = {
  currentLanguage: string;
  labels: ProfileLabels["language"];
  onChange: (langId: string) => void;
};

export function LanguageSection({ currentLanguage, labels, onChange }: LanguageSectionProps) {
  return (
    <div className="foodguard-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
          <Globe className="size-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{labels.title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{labels.subtitle}</p>
        </div>
      </div>

      <div className="space-y-2">
        {APP_LANGUAGES.map((lang) => (
          <button
            key={lang.id}
            type="button"
            onClick={() => onChange(lang.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              currentLanguage === lang.id
                ? "border-primary/40 bg-primary/5"
                : "border-border hover:border-border/80 hover:bg-muted/30",
            )}
          >
            <div>
              <p className="text-sm font-medium text-foreground">{lang.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{lang.nativeLabel}</p>
            </div>
            {currentLanguage === lang.id && (
              <div className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3.5" aria-hidden="true" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
