"use client";

import { useEffect, useRef, useState } from "react";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputType = value.trim() ? detectInputType(value) : null;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const resizeTextarea = () => {
      textarea.style.height = "auto";
      const borderHeight = textarea.offsetHeight - textarea.clientHeight;
      textarea.style.height = `${textarea.scrollHeight + borderHeight + 2}px`;
      textarea.style.overflowY = textarea.scrollHeight > textarea.clientHeight ? "auto" : "hidden";
    };

    resizeTextarea();
    window.addEventListener("resize", resizeTextarea);
    return () => window.removeEventListener("resize", resizeTextarea);
  }, [value]);

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

      <form onSubmit={handleSubmit} className="relative min-w-0">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground"
            aria-hidden="true"
          />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            rows={1}
            className={cn(
              "block w-full min-w-0 max-h-48 overflow-x-hidden overflow-y-hidden rounded-2xl border border-border bg-background py-3 pl-11 pr-[6.5rem] text-sm text-foreground placeholder:text-xs placeholder:leading-[1.75] placeholder:text-muted-foreground shadow-sm resize-none sm:py-4 sm:pl-12 sm:pr-32 sm:text-base sm:placeholder:text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              "transition-colors duration-200",
            )}
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={handlePaste}
              className="shrink-0 rounded-lg border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:p-2"
              aria-label="Paste from clipboard"
            >
              <ClipboardPaste className="size-4" />
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="shrink-0 rounded-xl bg-primary px-2 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed sm:px-3 sm:text-sm"
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
