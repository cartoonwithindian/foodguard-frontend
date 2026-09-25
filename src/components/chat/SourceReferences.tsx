"use client";

import { BookOpen } from "lucide-react";
import type { ChatSourceRef } from "@/types/chat";

export function SourceReferences({ sources }: { sources: ChatSourceRef[] }) {
  return (
    <div className="flex max-w-[92%] flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <BookOpen className="h-3.5 w-3.5" />
        Sources
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source, index) => (
          <span
            key={`${source.title}-${index}`}
            className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground"
          >
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
                data-testid={`chat-source-${index}`}
              >
                {source.title}
              </a>
            ) : (
              <span data-testid={`chat-source-${index}`}>{source.title}</span>
            )}
            <span className="text-muted-foreground/70">{source.source}</span>
          </span>
        ))}
      </div>
    </div>
  );
}