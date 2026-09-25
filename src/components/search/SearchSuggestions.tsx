"use client";

import { Lightbulb } from "lucide-react";

type SearchSuggestionsProps = {
  title: string;
  suggestions: string[];
  onSelect: (suggestion: string) => void;
};

export function SearchSuggestions({
  title,
  suggestions,
  onSelect,
}: SearchSuggestionsProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSelect(s)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted hover:border-primary/30"
          >
            <Lightbulb className="size-3 text-muted-foreground" aria-hidden="true" />
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
