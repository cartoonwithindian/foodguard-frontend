"use client";

import { SearchX, RefreshCw, ScanLine } from "lucide-react";
import type { ProductCategory } from "@/data/product-display";

type EmptySearchStateProps = {
  title: string;
  description: string;
  clearFiltersLabel: string;
  searchAgainLabel: string;
  tryNameLabel: string;
  categoryTitle: string;
  popularTitle: string;
  categories: { key: ProductCategory; label: string }[];
  popularSearches: string[];
  onClearFilters: () => void;
  onSearchAgain: () => void;
  onSelectCategory: (category: ProductCategory) => void;
  onSelectPopular: (search: string) => void;
  scanBarcodeLabel?: string;
  onScan?: () => void;
};

export function EmptySearchState({
  title,
  description,
  clearFiltersLabel,
  searchAgainLabel,
  categoryTitle,
  popularTitle,
  categories,
  popularSearches,
  onClearFilters,
  onSearchAgain,
  onSelectCategory,
  onSelectPopular,
  scanBarcodeLabel = "Scan a barcode instead",
  onScan,
}: EmptySearchStateProps) {
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
          {description}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {clearFiltersLabel}
        </button>
        <button
          type="button"
          onClick={onSearchAgain}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {searchAgainLabel}
        </button>
        {onScan && (
          <button
            type="button"
            onClick={onScan}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <ScanLine className="size-4" aria-hidden="true" />
            {scanBarcodeLabel}
          </button>
        )}
      </div>

      <div className="w-full max-w-md space-y-5 pt-4">
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">
            {categoryTitle}
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => onSelectCategory(cat.key)}
                className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:border-primary/30"
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">
            {popularTitle}
          </h4>
          <div className="flex flex-wrap gap-2">
            {popularSearches.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSelectPopular(s)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
