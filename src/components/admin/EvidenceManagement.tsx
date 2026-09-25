"use client";

import { useState } from "react";
import { Search, Eye, CheckCircle, Pencil, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvidenceEntry } from "@/data/admin-data";
import type { AdminLabels } from "@/data/admin-labels";

type EvidenceManagementProps = {
  entries: EvidenceEntry[];
  labels: AdminLabels["evidenceManagement"];
};

const STATUS_STYLES: Record<string, { dot: string; text: string; bg: string }> = {
  verified: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
  pending: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
  outdated: { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50" },
};

const STATUS_LABELS: Record<string, string> = {
  verified: "verified",
  pending: "pending",
  outdated: "outdated",
};

const SOURCE_TYPE_COLORS: Record<string, string> = {
  government: "bg-blue-50 text-blue-700",
  regulatory: "bg-purple-50 text-purple-700",
  scientific: "bg-teal-50 text-teal-700",
  product_information: "bg-gray-50 text-gray-600",
  food_database: "bg-orange-50 text-orange-700",
};

export function EvidenceManagement({ entries, labels }: EvidenceManagementProps) {
  const [search, setSearch] = useState("");

  const filtered = entries.filter(
    (e) =>
      e.sourceName.toLowerCase().includes(search.toLowerCase()) ||
      e.relatedTo.toLowerCase().includes(search.toLowerCase()) ||
      e.sourceType.replace("_", " ").includes(search.toLowerCase()),
  );

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">{labels.title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{labels.unsupportedWarning}</p>
        </div>
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
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary sm:w-64"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.source}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.type}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.relatedTo}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.status}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.lastVerified}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.evidence}
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                {labels.columns.actions}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((entry) => {
              const statusStyle = STATUS_STYLES[entry.status] ?? STATUS_STYLES.pending;
              const statusKey = STATUS_LABELS[entry.status] ?? "pending";
              const statusLabel = statusKey === "verified" ? labels.verified : statusKey === "outdated" ? labels.outdated : labels.pending;
              return (
                <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                    {entry.sourceName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        SOURCE_TYPE_COLORS[entry.sourceType] ?? "bg-gray-50 text-gray-600",
                      )}
                    >
                      {entry.sourceType.replace("_", " ")}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    <span className="text-xs text-muted-foreground/70">
                      {entry.relatedType === "ingredient" ? "ING" : "PRD"}
                    </span>{" "}
                    {entry.relatedTo}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                        statusStyle.bg,
                        statusStyle.text,
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", statusStyle.dot)} aria-hidden="true" />
                      {statusLabel}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {entry.lastVerified}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {entry.evidenceAvailable ? (
                      <CheckCircle className="size-4 text-emerald-600" aria-label="Available" />
                    ) : (
                      <span className="text-xs text-gray-400">--</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={labels.view}
                        title={labels.view}
                      >
                        <Eye className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                        aria-label={labels.verify}
                        title={labels.verify}
                      >
                        <CheckCircle className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={labels.update}
                        title={labels.update}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-700"
                        aria-label={labels.archive}
                        title={labels.archive}
                      >
                        <Archive className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
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
