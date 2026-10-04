"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MoreHorizontal, Eye, Trash2 } from "lucide-react";
import { CATEGORY_LABELS, CONCERN_COLORS } from "@/data/mock-data";
import type { HistoryLabels } from "@/data/history-labels";
import type { HistoryItem } from "@/data/history-data";

type HistoryProductCardProps = {
  product: HistoryItem;
  labels: HistoryLabels["productCard"];
  deleteLabels: HistoryLabels["delete"];
  onViewAnalysis: (id: string) => void;
  onDelete: (id: string) => void;
};

export function HistoryProductCard({
  product,
  labels,
  deleteLabels,
  onViewAnalysis,
  onDelete,
}: HistoryProductCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const colors = product.assessment === "high"
    ? CONCERN_COLORS.high
    : product.assessment === "moderate"
      ? CONCERN_COLORS.moderate
      : product.assessment === "low"
        ? CONCERN_COLORS.low
        : { bg: "bg-gray-50 dark:bg-gray-900/40", text: "text-gray-700 dark:text-gray-400", dot: "bg-gray-400" };
  const concernLabel =
    product.assessment === "high"
      ? "High Concern"
      : product.assessment === "moderate"
        ? "Moderate Concern"
        : "Low Concern";

  const formattedDate = new Date(product.scannedAt).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleMenuToggle = useCallback(() => setMenuOpen((p) => !p), []);

  return (
    <div className="group relative flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm transition-all hover:border-primary/30 hover:shadow">
      {/* Product icon placeholder */}
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
        {product.analysis.imageUrl && !imageFailed ? (
          <img
            src={product.analysis.imageUrl}
            alt=""
            className="size-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="text-lg font-bold text-muted-foreground">
            {product.name.charAt(0)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {product.name}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {CATEGORY_LABELS[product.category]}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
          >
            <span className={`size-1.5 rounded-full ${colors.dot}`} aria-hidden="true" />
            {concernLabel}
          </span>
          <span className="text-xs text-muted-foreground">
            {labels.scanned}: {formattedDate}
          </span>
        </div>
      </div>

      {/* View analysis — always visible on desktop, hidden on mobile */}
      <button
        type="button"
        onClick={() => onViewAnalysis(product.id)}
        className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-muted/50 sm:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {labels.viewAnalysis}
      </button>

      {/* Mobile view analysis button */}
      <button
        type="button"
        onClick={() => onViewAnalysis(product.id)}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/30 sm:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label={`${labels.viewAnalysis} ${product.name}`}
      >
        <Eye className="size-3.5" aria-hidden="true" />
      </button>

      {/* Three-dot menu */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={handleMenuToggle}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={deleteLabels.menuLabel}
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-xl border border-border bg-card p-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onViewAnalysis(product.id);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Eye className="size-4 text-muted-foreground" aria-hidden="true" />
              {deleteLabels.viewAnalysis}
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDelete(product.id);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {deleteLabels.deleteAction}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
