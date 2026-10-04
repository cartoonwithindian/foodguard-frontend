import { BookOpen, ExternalLink } from "lucide-react";
import type { EvidenceSource } from "@/data/analysis-data";

type EvidenceSourcesProps = {
  title: string;
  labels: {
    sourceType: string;
    summary: string;
    viewSource: string;
  };
  sources: EvidenceSource[];
};

export function EvidenceSources({
  title,
  labels,
  sources,
}: EvidenceSourcesProps) {
  if (sources.length === 0) return null;

  return (
    <div className="foodguard-card flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-3">
        {sources.map((source, i) => (
          <div key={i} className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {source.sourceName}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {source.evidenceCategory ?? "REFERENCE"} · {labels.sourceType}: {source.sourceType}
                </p>
              </div>
              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <ExternalLink className="size-3" aria-hidden="true" />
                  {labels.viewSource}
                </a>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {source.summary}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
