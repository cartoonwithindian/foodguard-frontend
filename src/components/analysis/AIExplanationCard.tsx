"use client";

import { Sparkles } from "lucide-react";

type AIExplanationCardProps = {
  /** The analysis narrative produced by the scoring pipeline. */
  explanation: string;
  /** Optional transparency line, e.g. how the score was derived. */
  note?: string;
};

/**
 * Clearly separates AI-generated explanation from raw product data.
 *
 * The content is the real scoring narrative (`foodguardScore.explanation`) —
 * nothing is invented here; the card only frames it.
 */
export function AIExplanationCard({ explanation, note }: AIExplanationCardProps) {
  if (!explanation?.trim()) return null;

  return (
    <section
      className="foodguard-card border-primary/20 bg-primary-light/30 p-5 sm:p-6"
      aria-labelledby="ai-explanation-heading"
    >
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
        </span>
        <h3 id="ai-explanation-heading" className="text-base font-semibold text-foreground">
          Why this score?
        </h3>
        <span className="foodguard-eyebrow ml-auto text-primary">AI-generated</span>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">
        {explanation}
      </p>
      {note ? (
        <p className="mt-3 border-t border-primary/15 pt-3 text-xs leading-relaxed text-muted-foreground">
          {note}
        </p>
      ) : null}
    </section>
  );
}
