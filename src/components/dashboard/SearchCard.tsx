"use client";

import { Search } from "lucide-react";
import type { DashboardLabels } from "@/data/dashboard-labels";

type SearchCardProps = {
  labels: DashboardLabels["search"];
  onClick: () => void;
};

export function SearchCard({ labels, onClick }: SearchCardProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-3.5 size-5 text-muted-foreground" aria-hidden="true" />
      <button
        type="button"
        onClick={onClick}
        className="flex h-12 w-full items-center rounded-xl border border-border bg-card pl-10 pr-4 text-left text-sm text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-light/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {labels.placeholder}
      </button>
    </div>
  );
}
