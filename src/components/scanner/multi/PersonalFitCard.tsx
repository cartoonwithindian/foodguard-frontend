/**
 * Multi-Product Scanner — personal fit card (Phase 5, Step 6/16/17/20).
 *
 * Design rules this component is built to enforce:
 *
 *  - The four information kinds are visually distinct and separately labelled:
 *    PRODUCT FACT (from the label), YOUR CONTEXT (from the stored profile/log),
 *    CALCULATION (our arithmetic), AI INTERPRETATION (the model's phrasing).
 *  - An unavailable number is rendered as "Not available". It is never 0.
 *  - The fit badge can never appear without the hard-constraint banner.
 *  - A failed or rejected JEV degrades the *sentence* only. The badge, the
 *    arithmetic, and the evidence stay on screen.
 *  - "See Why" is a disclosure, not a modal, so the reasoning is auditable.
 */
"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Info, Loader2, Sparkles } from "lucide-react";
import type { PersonalDecision } from "@/lib/personalization/decision-engine";
import type { NutrientImpact, PersonalFit } from "@/lib/personalization/context-engine";
import { cn } from "@/lib/utils";

const FIT_STYLES: Record<PersonalFit, { label: string; chip: string }> = {
  HIGH: {
    label: "Fits your day",
    chip: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  },
  MEDIUM: {
    label: "Moderate fit",
    chip: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  },
  LOW: {
    label: "Uses a lot of your remaining budget",
    chip: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100",
  },
  CONFLICT: {
    label: "Conflicts with a restriction you set",
    chip: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
  },
  UNKNOWN: {
    label: "Not enough context yet",
    chip: "bg-muted text-muted-foreground",
  },
};

const UNAVAILABLE_COPY: Record<NonNullable<NutrientImpact["unavailableReason"]>, string> = {
  product_nutrition_missing: "This product's label does not report it.",
  basis_unavailable: "No serving size on the label, so it cannot be calculated.",
  today_unavailable: "Nothing logged for today, so your remaining budget is unknown.",
  no_target: "No daily reference is set for this nutrient.",
};

function fmt(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} ${unit}`;
}

function jevNotice(decision: PersonalDecision): { tone: string; text: string } | null {
  switch (decision.jevStatus.state) {
    case "ok":
      return null;
    case "unavailable":
      return {
        tone: "text-muted-foreground",
        text:
          decision.jevStatus.code === "jev_unavailable"
            ? "Personalized wording is turned off. The numbers below are still calculated for you."
            : "Personalized wording is unavailable right now. The numbers below are still calculated for you.",
      };
    case "rejected":
      return {
        tone: "text-amber-700 dark:text-amber-300",
        text:
          decision.jevStatus.code === "banned_claim"
            ? "The personalized wording was discarded because it made a health claim the data does not support."
            : "The personalized wording was discarded because it softened a restriction you set.",
      };
  }
}

export type PersonalFitCardProps = {
  decision: PersonalDecision;
  /** True while a refresh is in flight. */
  refreshing?: boolean;
  onRefresh?: () => void;
  onLog?: (decision: PersonalDecision) => void;
  loggedToday?: boolean;
};

export function PersonalFitCard({
  decision,
  refreshing = false,
  onRefresh,
  onLog,
  loggedToday = false,
}: PersonalFitCardProps) {
  const [whyOpen, setWhyOpen] = useState(false);
  const fit = FIT_STYLES[decision.fit];
  const notice = jevNotice(decision);
  const hard = decision.hardConstraints.filter((c) => c.severity === "hard");
  const advisories = decision.hardConstraints.filter((c) => c.severity === "advisory");

  // Only nutrients that actually carry a number get a bar; the rest are
  // listed plainly so an absence is visible rather than implied.
  const trackable = decision.analysis.impacts.filter((i) => i.productAmount !== null);
  const untrackable = decision.analysis.impacts.filter((i) => i.productAmount === null);

  return (
    <section
      aria-label={`Personal fit for ${decision.productName}`}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
    >
      {/* ── Fit verdict ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
            fit.chip,
          )}
        >
          {fit.label}
        </span>
        {decision.analysis.todayAvailable === false && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Info className="size-3.5" aria-hidden="true" />
            No food logged today
          </span>
        )}
      </div>

      {/* ── Hard constraints always outrank the fit badge ── */}
      {hard.length > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-1.5 rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40"
        >
          <p className="flex items-center gap-1.5 text-sm font-semibold text-red-900 dark:text-red-100">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            Conflicts with something you told us to avoid
          </p>
          <ul className="flex flex-col gap-1">
            {hard.map((c, i) => (
              <li key={`hard-${i}`} className="text-sm text-red-900 dark:text-red-100">
                • {c.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {advisories.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            May contain
          </p>
          <ul className="flex flex-col gap-0.5">
            {advisories.map((c, i) => (
              <li key={`adv-${i}`} className="text-sm text-muted-foreground">
                • {c.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── The sentence, and who wrote it ── */}
      <div className="flex flex-col gap-1.5">
        <p className="text-base text-foreground">{decision.headline}</p>
        <p className="text-sm leading-relaxed text-foreground">{decision.explanation}</p>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {decision.explanationSource === "ai" ? (
            <>
              <Sparkles className="size-3" aria-hidden="true" />
              Wording by{" "}
              {decision.jevStatus.state === "ok" && decision.jevStatus.source === "qwen"
                ? "AI"
                : "on-device rules"}
              . Numbers are calculated, not generated.
            </>
          ) : (
            <>This wording is calculated from your data, not generated.</>
          )}
        </p>
        {notice && <p className={cn("text-xs", notice.tone)}>{notice.text}</p>}
      </div>

      {/* ── Deterministic impact bars ── */}
      <div className="flex flex-col gap-2.5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Your day so far
        </h4>
        {trackable.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not enough reported nutrition to place this in your day.
          </p>
        ) : (
          trackable.map((impact) => (
            <ImpactRow key={impact.key} impact={impact} />
          ))
        )}
        {untrackable.length > 0 && (
          <ul className="flex flex-col gap-0.5 border-t border-border pt-2">
            {untrackable.map((impact) => (
              <li key={impact.key} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{impact.label}</span>
                <span className="text-right text-xs text-muted-foreground">
                  Not available —{" "}
                  {UNAVAILABLE_COPY[impact.unavailableReason ?? "product_nutrition_missing"]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Priority factors ── */}
      {decision.priorityFactors.length > 0 && (
        <ul className="flex flex-col gap-1">
          {decision.priorityFactors.slice(0, 3).map((f, i) => (
            <li key={`pf-${i}`} className="text-sm text-foreground">
              • {f}
            </li>
          ))}
        </ul>
      )}

      {/* ── Uncertainties ── */}
      {decision.uncertainties.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            What we are unsure about
          </p>
          <ul className="flex flex-col gap-0.5">
            {decision.uncertainties.slice(0, 4).map((u, i) => (
              <li key={`u-${i}`} className="text-sm text-muted-foreground">
                • {u}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex flex-wrap items-center gap-2">
        {onLog && (
          <button
            type="button"
            onClick={() => onLog(decision)}
            disabled={loggedToday}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loggedToday ? "Logged to today" : "Add to today's log"}
          </button>
        )}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Recalculate
          </button>
        )}
      </div>

      {/* ── See Why ── */}
      <button
        type="button"
        onClick={() => setWhyOpen((v) => !v)}
        aria-expanded={whyOpen}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        See Why
        <ChevronDown
          className={cn("size-4 transition-transform", whyOpen && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {whyOpen && (
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          <ReasoningChain decision={decision} />
          <EvidenceList decision={decision} />
        </div>
      )}
    </section>
  );
}

/** One nutrient: consumed → plus this serving → what is left. */
function ImpactRow({ impact }: { impact: NutrientImpact }) {
  const { consumedBefore, productAmount, remainingAfter, unit, direction } = impact;
  const crosses = impact.remainingAfter !== null && impact.remainingAfter < 0;
  const filled =
    impact.remainingBefore !== null && impact.remainingBefore > 0 && productAmount !== null
      ? Math.min(100, Math.round((productAmount / impact.remainingBefore) * 100))
      : null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-foreground">{impact.label}</span>
        <span className={cn("tabular-nums", crosses ? "font-semibold text-red-700 dark:text-red-300" : "text-muted-foreground")}>
          {remainingAfter === null
            ? "Not available"
            : crosses
              ? `${fmt(Math.abs(remainingAfter), unit)} over`
              : `${fmt(remainingAfter, unit)} left`}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {consumedBefore === null
          ? "Consumed today: not known"
          : `Consumed today: ${fmt(consumedBefore, unit)}`}
        {productAmount !== null && <> · This serving: {fmt(productAmount, unit)}</>}
        {direction === "toward_minimum" && <> · counted toward a daily minimum</>}
      </p>
      {filled !== null && (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="presentation"
        >
          <div
            className={cn("h-full rounded-full", crosses ? "bg-red-500" : "bg-foreground/70")}
            style={{ width: `${filled}%` }}
          />
        </div>
      )}
    </div>
  );
}

/** Step 17 — the arithmetic, in the order the engine applied it. */
function ReasoningChain({ decision }: { decision: PersonalDecision }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        How this was calculated
      </h4>
      <ol className="flex flex-col gap-2">
        {decision.reasoningChain.map((step, i) => (
          <li key={`chain-${i}`} className="flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {step.label}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  step.isAi
                    ? "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {step.isAi ? "AI phrasing" : "Calculated"}
              </span>
            </div>
            <p className="text-sm text-foreground">
              {step.unavailable ? "Not available — insufficient data" : step.value}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Step 16 — facts, context, and calculations, each labelled with its origin. */
function EvidenceList({ decision }: { decision: PersonalDecision }) {
  const KIND_COPY = {
    product_fact: "Product fact",
    personal_context: "Your context",
    calculation: "Calculation",
  } as const;
  const byKind = {
    product_fact: decision.evidence.filter((e) => e.kind === "product_fact"),
    personal_context: decision.evidence.filter((e) => e.kind === "personal_context"),
    calculation: decision.evidence.filter((e) => e.kind === "calculation"),
  };

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Where this comes from
      </h4>
      {(Object.keys(byKind) as Array<keyof typeof byKind>).map((kind) =>
        byKind[kind].length === 0 ? null : (
          <div key={kind} className="flex flex-col gap-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {KIND_COPY[kind]}
            </p>
            <ul className="flex flex-col gap-0.5">
              {byKind[kind].map((e, i) => (
                <li key={`${kind}-${i}`} className="text-sm text-foreground">
                  • {e.text}
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}
