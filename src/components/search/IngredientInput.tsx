"use client";

import { useState } from "react";
import { ClipboardPaste, Search, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { detectInputType } from "@/data/search-data";

type IngredientInputProps = {
  placeholder: string;
  searchButton: string;
  inputTypeLabels: {
    productLabel: string;
    ingredientLabel: string;
    ingredientListLabel: string;
    detectedAs: string;
  };
  contextMessage?: string;
  onSearch: (value: string) => void;
};

export function IngredientInput({
  placeholder,
  searchButton,
  inputTypeLabels,
  contextMessage,
  onSearch,
}: IngredientInputProps) {
  const [value, setValue] = useState("");
  const inputType = value.trim() ? detectInputType(value) : null;

  const typeLabel =
    inputType === "ingredient_list"
      ? inputTypeLabels.ingredientListLabel
      : inputType === "ingredient"
        ? inputTypeLabels.ingredientLabel
        : inputTypeLabels.productLabel;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSearch(value.trim());
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setValue(text);
      }
    } catch {
      // clipboard access denied
    }
  };

  return (
    <div className="space-y-3">
      {contextMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-primary/5 px-3.5 py-2 text-xs font-medium text-primary">
          <ClipboardPaste className="size-3.5 shrink-0" aria-hidden="true" />
          {contextMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground"
            aria-hidden="true"
          />
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            rows={value.includes(",") || value.split("\n").length > 1 ? 3 : 1}
            className={cn(
              "w-full rounded-2xl border border-border bg-background py-4 pl-12 pr-24 text-base text-foreground placeholder:text-muted-foreground shadow-sm resize-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              "transition-all duration-200",
            )}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePaste}
              className="min-h-11 min-w-11 rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Paste from clipboard"
            >
              <ClipboardPaste className="size-4" />
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="min-h-11 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searchButton}
            </button>
          </div>
        </div>
      </form>

      {inputType && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Tag className="size-3" aria-hidden="true" />
          <span>
            {inputTypeLabels.detectedAs}:{" "}
            <span className="font-medium text-foreground">{typeLabel}</span>
          </span>
        </div>
      )}
    </div>
  );
}
