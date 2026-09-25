"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalysisLogEntry, LogProcessingStatus } from "@/data/admin-data";

type AnalysisLogsProps = {
  logs: AnalysisLogEntry[];
  labels: {
    title: string;
    viewDetails: string;
    columns: {
      id: string;
      product: string;
      createdTime: string;
      processing: string;
      ingredientProcessing: string;
      evidenceRetrieval: string;
      assessment: string;
      aiExplanation: string;
      errorStatus: string;
      actions: string;
    };
    pipeline: {
      title: string;
      productLookup: string;
      ingredientNormalization: string;
      nutritionProcessing: string;
      evidenceRetrieval: string;
      assessment: string;
      aiExplanation: string;
      success: string;
      pending: string;
      failed: string;
      skipped: string;
    };
  };
};

const STATUS_STYLES: Record<LogProcessingStatus, { dot: string; text: string }> = {
  success: { dot: "bg-emerald-500", text: "text-emerald-700" },
  pending: { dot: "bg-amber-500", text: "text-amber-700" },
  failed: { dot: "bg-red-500", text: "text-red-700" },
  skipped: { dot: "bg-gray-400", text: "text-gray-500" },
};

function StatusDot({ status }: { status: LogProcessingStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden="true" />
      <span className={cn("text-xs font-medium", s.text)}>{status}</span>
    </span>
  );
}

export function AnalysisLogs({ logs, labels }: AnalysisLogsProps) {
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const pipelineSteps = [
    { key: "processing" as const, label: labels.pipeline.productLookup },
    { key: "ingredientProcessing" as const, label: labels.pipeline.ingredientNormalization },
    { key: "evidenceRetrieval" as const, label: labels.pipeline.evidenceRetrieval },
    { key: "assessment" as const, label: labels.pipeline.assessment },
    { key: "aiExplanation" as const, label: labels.pipeline.aiExplanation },
  ];

  return (
    <section>
      <h2 className="mb-4 text-base font-semibold text-foreground">{labels.title}</h2>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.id}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.product}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.createdTime}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.processing}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.ingredientProcessing}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.evidenceRetrieval}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.assessment}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.aiExplanation}
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {labels.columns.errorStatus}
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                {labels.columns.actions}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                  {log.id}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                  {log.productName}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {log.createdTime}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusDot status={log.processing} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusDot status={log.ingredientProcessing} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusDot status={log.evidenceRetrieval} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusDot status={log.assessment} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusDot status={log.aiExplanation} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusDot status={log.errorStatus} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedLog(expandedLog === log.id ? null : log.id)
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <Eye className="size-3" aria-hidden="true" />
                    {labels.viewDetails}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pipeline detail panel */}
      {expandedLog && (
        <div className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            {labels.pipeline.title} — {logs.find((l) => l.id === expandedLog)?.productName}
          </h3>
          <div className="flex flex-col items-start gap-0">
            {pipelineSteps.map((step, i) => {
              const log = logs.find((l) => l.id === expandedLog);
              const status = log?.[step.key] ?? "skipped";
              const s = STATUS_STYLES[status];
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs font-bold text-white",
                        status === "success"
                          ? "bg-emerald-500"
                          : status === "failed"
                            ? "bg-red-500"
                            : status === "pending"
                              ? "bg-amber-500"
                              : "bg-gray-400",
                      )}
                    >
                      {i + 1}
                    </span>
                    {i < pipelineSteps.length - 1 && (
                      <div className="h-4 w-px bg-border" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{step.label}</p>
                    <p className={cn("text-xs capitalize", s.text)}>{status}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {logs.find((l) => l.id === expandedLog)?.errorMessage && (
            <div className="mt-4 rounded-lg bg-red-50 p-3">
              <p className="text-xs font-medium text-red-700">Error</p>
              <p className="mt-0.5 text-sm text-red-600">
                {logs.find((l) => l.id === expandedLog)?.errorMessage}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
