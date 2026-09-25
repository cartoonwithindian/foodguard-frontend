"use client";

import { cn } from "@/lib/utils";
import type { DataQualityIssue, DataQualitySeverity } from "@/data/admin-data";
import type { AdminLabels } from "@/data/admin-labels";

type DataQualityProps = {
  issues: DataQualityIssue[];
  labels: AdminLabels["dataQuality"];
};

const SEVERITY_STYLES: Record<DataQualitySeverity, { dot: string; text: string; bg: string }> = {
  high: { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50" },
  medium: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
  low: { dot: "bg-gray-400", text: "text-gray-600", bg: "bg-gray-50" },
};

const STATUS_STYLES: Record<string, { dot: string; text: string; bg: string }> = {
  open: { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50" },
  under_review: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
  resolved: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
};

const STATUS_LABELS: Record<string, string> = {
  open: "open",
  under_review: "underReview",
  resolved: "resolved",
};

export function DataQuality({ issues, labels }: DataQualityProps) {
  return (
    <section>
      <h2 className="mb-4 text-base font-semibold text-foreground">{labels.title}</h2>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.target}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.issueType}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.severity}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.dateDetected}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.status}
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                {labels.columns.action}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {issues.map((issue) => {
              const sevStyle = SEVERITY_STYLES[issue.severity];
              const statStyle = STATUS_STYLES[issue.status] ?? STATUS_STYLES.open;
              const statKey = STATUS_LABELS[issue.status] ?? "open";
              const statLabel = statKey === "open" ? labels.open : statKey === "underReview" ? labels.underReview : labels.resolved;
              return (
                <tr key={issue.id} className="hover:bg-muted/30 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground/60 uppercase">
                        {issue.targetType === "product" ? "PRD" : "ING"}
                      </span>
                      <span className="font-medium text-foreground">{issue.target}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {issue.issueType}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                        sevStyle.bg,
                        sevStyle.text,
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", sevStyle.dot)} aria-hidden="true" />
                      {issue.severity}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {issue.dateDetected}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                        statStyle.bg,
                        statStyle.text,
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", statStyle.dot)} aria-hidden="true" />
                      {statLabel}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {issue.status !== "resolved" && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        {labels.review}
                      </button>
                    )}
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
