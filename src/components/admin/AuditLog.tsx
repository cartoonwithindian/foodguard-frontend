"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditLogEntry, AuditAction } from "@/data/admin-data";
import type { AdminLabels } from "@/data/admin-labels";

type AuditLogProps = {
  entries: AuditLogEntry[];
  labels: AdminLabels["auditLog"];
};

const ACTION_STYLES: Record<AuditAction, { text: string; bg: string }> = {
  updated: { text: "text-blue-700", bg: "bg-blue-50" },
  verified: { text: "text-emerald-700", bg: "bg-emerald-50" },
  archived: { text: "text-gray-600", bg: "bg-gray-50" },
  suspended: { text: "text-red-700", bg: "bg-red-50" },
  created: { text: "text-violet-700", bg: "bg-violet-50" },
  deleted: { text: "text-red-700", bg: "bg-red-50" },
};

export function AuditLog({ entries, labels }: AuditLogProps) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const filtered = entries.filter((entry) => {
    const matchesSearch =
      entry.target.toLowerCase().includes(search.toLowerCase()) ||
      entry.admin.toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === "all" || entry.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-foreground">{labels.title}</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={labels.search}
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary sm:w-56"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Actions</option>
            <option value="updated">{labels.updated}</option>
            <option value="verified">{labels.verified}</option>
            <option value="archived">{labels.archived}</option>
            <option value="suspended">{labels.suspended}</option>
            <option value="created">{labels.created}</option>
            <option value="deleted">{labels.deleted}</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.action}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.admin}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.target}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.timestamp}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((entry) => {
              const style = ACTION_STYLES[entry.action] ?? ACTION_STYLES.updated;
              const actionLabel = labels[entry.action] ?? entry.action;
              return (
                <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        style.bg,
                        style.text,
                      )}
                    >
                      {actionLabel}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {entry.admin}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="text-xs font-medium text-muted-foreground/60 uppercase">
                      {entry.targetType.replace("_", " ")}
                    </span>{" "}
                    <span className="font-medium text-foreground">{entry.target}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {entry.timestamp}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
