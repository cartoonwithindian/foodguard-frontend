"use client";

import { Search, Bell, Menu } from "lucide-react";
import type { AdminLabels } from "@/data/admin-labels";

type AdminHeaderProps = {
  labels: AdminLabels["header"];
  onToggleSidebar?: () => void;
};

export function AdminHeader({ labels, onToggleSidebar }: AdminHeaderProps) {
  return (
    <header className="flex h-14 items-center border-b border-border bg-card px-4 lg:px-6">
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={onToggleSidebar}
        className="mr-3 inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
        aria-label="Toggle menu"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <h1 className="text-sm font-semibold text-foreground">{labels.title}</h1>

      <div className="ml-auto flex items-center gap-2">
        {/* Search */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={labels.search}
        >
          <Search className="size-4" aria-hidden="true" />
        </button>

        {/* Notifications */}
        <button
          type="button"
          className="relative inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={labels.notifications}
        >
          <Bell className="size-4" aria-hidden="true" />
          <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            3
          </span>
        </button>

        {/* Divider */}
        <div className="mx-1 h-5 w-px bg-border" />

        {/* Admin role */}
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            A
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium text-foreground">Admin</p>
            <p className="text-[11px] text-muted-foreground">{labels.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
