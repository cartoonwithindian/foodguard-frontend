"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight, Clock } from "lucide-react";
import type { ScannedProduct } from "@/types/dashboard";
import { CONCERN_COLORS } from "@/data/product-display";
import { SectionHeader } from "@/components/ui/SectionHeader";

const CONCERN_LABELS: Record<ScannedProduct["concern"], string> = {
  low: "✓ Low concern",
  moderate: "! Moderate",
  high: "!! High concern",
  insufficient: "? Insufficient data",
};

/**
 * The user's most recent real scans, straight from `/api/history`.
 *
 * Food-safety activity stays above gamification in the dashboard hierarchy.
 */
export function RecentScansCard({ scans }: { scans: ScannedProduct[] }) {
  const router = useRouter();

  if (scans.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="recent-scans-heading">
      <SectionHeader
        title="Recent scans"
        actions={
          <button
            type="button"
            onClick={() => router.push("/history")}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            View history
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </button>
        }
      />
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {scans.slice(0, 6).map((scan) => {
          const colors = CONCERN_COLORS[scan.concern] ?? CONCERN_COLORS.insufficient;
          return (
            <li key={scan.id}>
              <button
                type="button"
                onClick={() => router.push("/history")}
                className="foodguard-card flex w-full items-center gap-3 p-4 text-left transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-muted-foreground">
                  {scan.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{scan.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" aria-hidden="true" />
                    {scan.scannedAt}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${colors.bg} ${colors.text}`}
                >
                  {CONCERN_LABELS[scan.concern]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
