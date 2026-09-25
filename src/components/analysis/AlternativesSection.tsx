"use client";

import { useEffect, useRef, useState } from "react";
import {
  Trophy,
  ChevronDown,
  Shield,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Info,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnhancedAlternative } from "@/services/recommendation.service";
import type { AlternativeCharacteristicInfo } from "@/lib/alternative-characteristics";
import { apiUrl } from "@/lib/network/api-url";

type AlternativesSectionProps = {
  title: string;
  labels: {
    subtitle: string;
    preferenceMatch: string;
    fssaiStatus: string;
    dataConfidence: string;
    viewDetails: string;
    noAlternatives: string;
    lowerThan: string;
    higherThan: string;
    similarCategory: string;
    fewerConcerns: string;
    whatToLookFor?: string;
    whyMayBeBetter?: string;
  };
  alternatives: EnhancedAlternative[];
  productName: string;
  /**
   * Phase 5: characteristics returned by the backend ("What to look for").
   * Rendered verbatim — never hardcoded in the frontend.
   */
  alternativeCharacteristics?: AlternativeCharacteristicInfo[];
  /**
   * Phase 5: criteria metadata. Characteristics listed in `unsupported` are
   * shown as look-for suggestions, never as verified claims.
   */
  alternativeCriteria?: {
    preferredCharacteristics: string[];
    unsupported: string[];
  } | null;
  /** Current product id — used only for Phase 6 feedback tracking. */
  productId?: string;
};

/**
 * Phase 6: fire-and-forget behavioural feedback. Never awaited, never blocks
 * the UI. A failed feedback request must never affect alternatives.
 *
 * Per the Phase 6 design, ONLY events backed by an existing UI action are
 * tracked: VIEWED (card becomes visible) and CLICKED (card opened). The app has
 * no explicit select/dismiss action, so no new UX is invented for SELECTED /
 * REJECTED — those remain API-level events only.
 */
function sendAlternativeFeedback(
  productId: string | undefined,
  alternativeProductId: string,
  eventType: "VIEWED" | "CLICKED",
) {
  if (!productId || !alternativeProductId) return;
  void fetch(apiUrl(`/api/products/${encodeURIComponent(productId)}/alternatives/feedback`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alternativeProductId, eventType }),
  }).catch(() => {
    // Feedback recording is best-effort; failure is never surfaced to the user.
  });
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 75
      ? "bg-green-500"
      : score >= 50
        ? "bg-amber-500"
        : "bg-gray-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground">{score}</span>
    </div>
  );
}

function ReasonBadge({ reason }: { reason: { factor: string; detail: string } }) {
  const isPositive =
    reason.factor.startsWith("lower_") ||
    reason.factor === "fewer_additives" ||
    reason.factor === "higher_protein" ||
    reason.factor === "higher_fiber" ||
    reason.factor === "better_nutrition";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        isPositive
          ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400"
          : "bg-muted text-muted-foreground",
      )}
    >
      {isPositive ? (
        <TrendingDown className="size-3" aria-hidden="true" />
      ) : (
        <Star className="size-3" aria-hidden="true" />
      )}
      {reason.detail}
    </span>
  );
}

function FSSAIIndicator({ fssai }: { fssai?: EnhancedAlternative["fssai"] }) {
  if (!fssai) return null;
  const statusColor =
    fssai.overallStatus === "PASS"
      ? "text-green-600 dark:text-green-400"
      : fssai.overallStatus === "NEEDS_REVIEW"
        ? "text-amber-600 dark:text-amber-400"
        : "text-gray-500 dark:text-gray-400";

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Shield className="size-3" aria-hidden="true" />
      <span className={statusColor}>{fssai.overallStatus}</span>
      {fssai.concernsCount > 0 && (
        <span className="text-amber-600 dark:text-amber-400">
          ({fssai.concernsCount} concern{fssai.concernsCount > 1 ? "s" : ""})
        </span>
      )}
    </div>
  );
}

function AlternativeCard({
  alternative,
  rank,
  labels,
  productName,
  productId,
}: {
  alternative: EnhancedAlternative;
  rank: number;
  labels: AlternativesSectionProps["labels"];
  productName: string;
  productId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const viewedFiredRef = useRef(false);

  // Phase 5: only backend-validated criteria reasons are displayed as claims.
  // These come from the Phase 4 validation gate (factor "better_nutrition").
  const validatedReasons = alternative.reasons.filter(
    (r) => r.factor === "better_nutrition",
  );

  // Phase 6: VIEWED — fired once when the card first becomes visible.
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !viewedFiredRef.current) {
            viewedFiredRef.current = true;
            sendAlternativeFeedback(productId, alternative.product.id, "VIEWED");
          }
        }
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [productId, alternative.product.id]);

  const handleToggle = () => {
    // Phase 6: CLICKED — fired when the user opens the card.
    if (!isOpen) {
      sendAlternativeFeedback(productId, alternative.product.id, "CLICKED");
    }
    setIsOpen(!isOpen);
  };

  return (
    <div ref={cardRef} className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        {/* Rank badge */}
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            rank === 1
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
              : rank === 2
                ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                : "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
          )}
        >
          {rank}
        </div>

        {/* Product image (Open Food Facts) — hidden when unavailable */}
        {alternative.product.imageUrl ? (
          
          <img
            src={alternative.product.imageUrl}
            alt={alternative.product.name}
            loading="lazy"
            className="size-11 shrink-0 rounded-lg border border-border bg-muted object-cover"
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {alternative.product.name}
            </span>
            {alternative.product.brand && (
              <span className="text-xs text-muted-foreground">
                {alternative.product.brand}
              </span>
            )}
            {alternative.recommendationType === "better_match" && (
              <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
                Better
              </span>
            )}
            {alternative.recommendationType === "similar" && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                Similar
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {alternative.reasons.slice(0, 3).map((r, i) => (
              <ReasonBadge key={i} reason={r} />
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <ScoreBar score={alternative.recommendationScore} />
          <FSSAIIndicator fssai={alternative.fssai} />
        </div>

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div className="border-t border-border px-4 py-3 text-sm space-y-3">
          {/* Preference alignment */}
          {alternative.preferenceAlignment !== undefined && (
            <div className="flex items-center gap-2">
              <Info className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">
                {labels.preferenceMatch}:{" "}
                <span className="font-medium text-foreground">
                  {Math.round(alternative.preferenceAlignment * 100)}%
                </span>
              </span>
            </div>
          )}

          {/* Improvement details */}
          {Object.keys(alternative.improvement).length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Compared to {productName}:
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(alternative.improvement).map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-400"
                  >
                    {value.startsWith("-") ? (
                      <TrendingDown className="size-3" aria-hidden="true" />
                    ) : (
                      <TrendingUp className="size-3" aria-hidden="true" />
                    )}
                    {key}: {value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* FSSAI details */}
          {alternative.fssai && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <Shield className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">
                FSSAI: {alternative.fssai.additiveCount} additive{alternative.fssai.additiveCount !== 1 ? "s" : ""} found
                {alternative.fssai.concernsCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {" "}· {alternative.fssai.concernsCount} need{alternative.fssai.concernsCount === 1 ? "s" : ""} review
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Data confidence */}
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">
              {labels.dataConfidence}:{" "}
              {alternative.dataConfidence >= 0.7
                ? "High"
                : alternative.dataConfidence >= 0.4
                  ? "Medium"
                  : "Low"}
            </span>
          </div>

          {/* All reasons */}
          <div className="flex flex-wrap gap-1">
            {alternative.reasons.map((r, i) => (
              <ReasonBadge key={i} reason={r} />
            ))}
          </div>

          {/* Why better summary */}
          <p className="text-xs text-muted-foreground italic">
            {alternative.whyBetter}
          </p>

          {/* Phase 5: why this alternative is better — validated claims only */}
          {validatedReasons.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {labels.whyMayBeBetter}
              </span>
              <ul className="space-y-1">
                {validatedReasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-green-700 dark:text-green-400">
                    <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{r.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Phase 5: "What to look for" — rendered from backend-provided
 * characteristics, never hardcoded. Unsupported characteristics are phrased
 * as look-for suggestions (their descriptions already say "Look for ..."),
 * not as verified claims.
 */
function WhatToLookFor({
  characteristics,
  unsupported,
  label,
}: {
  characteristics: AlternativeCharacteristicInfo[];
  unsupported: string[];
  label?: string;
}) {
  const unsupportedSet = new Set(unsupported);
  return (
    <div className="mt-4 rounded-lg bg-muted/50 px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label ?? "What to look for"}
      </span>
      <ul className="mt-1.5 space-y-1">
        {characteristics.map((c) => (
          <li
            key={c.key}
            className="flex items-start gap-1.5 text-xs text-foreground"
          >
            <CheckCircle2 className="size-3.5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
            {unsupportedSet.has(c.key) ? (
              <span>{c.description}</span>
            ) : (
              <span>{c.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AlternativesSection({
  title,
  labels,
  alternatives,
  productName,
  alternativeCharacteristics,
  alternativeCriteria,
  productId,
}: AlternativesSectionProps) {
  if (!alternatives || alternatives.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Trophy className="size-5 text-primary" aria-hidden="true" />
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
        </div>
        {alternativeCharacteristics && alternativeCharacteristics.length > 0 && (
          <WhatToLookFor
            characteristics={alternativeCharacteristics}
            unsupported={alternativeCriteria?.unsupported ?? []}
            label={labels.whatToLookFor}
          />
        )}
        <p className="mt-3 text-sm text-muted-foreground">{labels.noAlternatives}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Trophy className="size-5 text-primary" aria-hidden="true" />
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>

      {alternativeCharacteristics && alternativeCharacteristics.length > 0 && (
        <WhatToLookFor
          characteristics={alternativeCharacteristics}
          unsupported={alternativeCriteria?.unsupported ?? []}
          label={labels.whatToLookFor}
        />
      )}

      {alternatives.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{labels.noAlternatives}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {alternatives.map((alt, i) => (
            <AlternativeCard
              key={alt.product.id}
              alternative={alt}
              rank={i + 1}
              labels={labels}
              productName={productName}
              productId={productId}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2">
        <AlertCircle className="size-3.5 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Alternatives are ranked by data-driven similarity and preference matching.
          This is not a health recommendation. Always check labels for your specific dietary needs.
        </p>
      </div>
    </div>
  );
}