"use client";

import { ChevronRight, History, Clock } from "lucide-react";
import type { DashboardLabels } from "@/data/dashboard-labels";
import type { ScannedProduct } from "@/types/dashboard";
import { CATEGORY_LABELS, CONCERN_COLORS } from "@/data/mock-data";

type RecentScansProps = {
  labels: DashboardLabels["recentScans"];
  scans: ScannedProduct[];
  onViewAll: () => void;
  onScan: () => void;
  hasScans: boolean;
};

export function RecentScans({
  labels,
  scans,
  onViewAll,
  onScan,
  hasScans,
}: RecentScansProps) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="size-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-base font-medium text-foreground">{labels.title}</h2>
        </div>
        {hasScans && (
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline dark:text-orange-400"
          >
            {labels.viewAll}
            <ChevronRight className="size-3.5" />
          </button>
        )}
      </div>

      {!hasScans ? (
        <div className="rounded-lg border border-dashed border-border py-8 text-center">
          <p className="text-sm font-medium text-foreground">{labels.noScansTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{labels.noScansDescription}</p>
          <button
            type="button"
            onClick={onScan}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-5 text-sm font-medium text-white"
          >
            {labels.noScansButton}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {scans.slice(0, 5).map((product) => {
            const colors = CONCERN_COLORS[product.concern];
            const concernLabel =
              product.concern === "high"
                ? "High concern"
                : product.concern === "moderate"
                  ? "Moderate"
                  : "Lower concern";

            return (
              <button
                key={product.id}
                type="button"
                onClick={onViewAll}
                className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted"
              >
                <div className={`flex size-8 items-center justify-center rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                  {product.concern === "low" ? "L" : product.concern === "high" ? "H" : "M"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {product.name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    <span>{product.scannedAt}</span>
                    <span>· {CATEGORY_LABELS[product.category]}</span>
                  </div>
                  <span className={`mt-1 inline-block text-xs font-medium ${colors.text}`}>
                    {concernLabel}
                  </span>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
