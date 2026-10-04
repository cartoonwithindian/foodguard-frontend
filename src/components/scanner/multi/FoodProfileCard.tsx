/**
 * Multi-Product Scanner — food profile card (Phase 4).
 *
 * Descriptive product understanding only: identity, serving, nutrition
 * ("Not available", never 0), ingredients, and evidence-grounded food
 * understanding. No health judgments, no scores, no personalization —
 * those belong to later phases.
 */
"use client";

import { useState } from "react";
import { ChevronDown, FlaskConical } from "lucide-react";
import {
  PROFILE_NUTRIENT_ORDER,
  type ProductFoodProfile,
} from "@/lib/multi-scan/food-profile";
import { cn } from "@/lib/utils";

const KEY_NUTRIENTS = ["calories", "totalSugar", "protein", "fiber", "sodium"] as const;

function formatAmount(profile: ProductFoodProfile, key: (typeof PROFILE_NUTRIENT_ORDER)[number]["key"]): string {
  const n = profile.nutrition[key];
  if (!n) return "Not available";
  return `${n.value} ${n.unit}`;
}

function basisLabel(profile: ProductFoodProfile): string | null {
  if (profile.nutrition.basis === "PER_100G") return "per 100g";
  if (profile.nutrition.basis === "PER_SERVING") return "per serving";
  return null;
}

export function FoodProfileCard({ profile }: { profile: ProductFoodProfile }) {
  const [expanded, setExpanded] = useState(false);
  const basis = basisLabel(profile);
  const understanding = profile.understanding;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      {/* Identity */}
      <div className="flex items-start gap-3">
        {(profile.image || null) && (
          <img
            src={profile.image as string}
            alt=""
            aria-hidden="true"
            className="size-16 shrink-0 rounded-xl border border-border bg-muted object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-semibold text-foreground">
            {profile.productName}
          </h3>
          {profile.brand && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{profile.brand}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Serving: {profile.servingSize ?? "Not available"}
            {basis ? ` (${basis})` : ""}
          </p>
        </div>
      </div>

      {/* Key nutrition */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {KEY_NUTRIENTS.map((key) => {
          const meta = PROFILE_NUTRIENT_ORDER.find((n) => n.key === key)!;
          return (
            <div key={key} className="flex flex-col rounded-xl bg-muted/50 px-3 py-2">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {meta.label}
              </dt>
              <dd className="text-sm font-semibold text-foreground">
                {formatAmount(profile, key)}
              </dd>
            </div>
          );
        })}
        <div className="flex flex-col rounded-xl bg-muted/50 px-3 py-2">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Basis
          </dt>
          <dd className="text-sm font-semibold text-foreground">{basis ?? "Not available"}</dd>
        </div>
      </dl>

      {/* Ingredients preview */}
      <div className="flex flex-col gap-1.5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ingredients
        </h4>
        {profile.ingredients.normalized.length > 0 ? (
          <p className="text-sm text-foreground">
            {profile.ingredients.normalized.slice(0, 6).join(" · ")}
            {profile.ingredients.normalized.length > 6 &&
              ` +${profile.ingredients.normalized.length - 6} more`}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Not available</p>
        )}
      </div>

      {/* Food understanding */}
      <div className="flex flex-col gap-1.5">
        <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <FlaskConical className="size-3.5" aria-hidden="true" />
          Food Understanding
        </h4>
        {understanding &&
        (understanding.ingredientInsights.length > 0 ||
          understanding.nutritionInsights.length > 0) ? (
          <ul className="flex flex-col gap-1">
            {understanding.ingredientInsights.slice(0, 3).map((insight, i) => (
              <li key={`ing-${i}`} className="text-sm text-foreground">
                • {insight.label}
              </li>
            ))}
            {understanding.nutritionInsights.slice(0, 3).map((insight, i) => (
              <li key={`nut-${i}`} className="text-sm text-foreground">
                • {insight.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {profile.status === "understanding_failed"
              ? "AI ingredient interpretation unavailable."
              : "No additional observations available."}
          </p>
        )}
      </div>

      {/* Full analysis toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        View Full Analysis
        <ChevronDown
          className={cn("size-4 transition-transform", expanded && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          <div className="flex flex-col gap-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nutrition{basis ? ` (${basis})` : ""}
            </h4>
            <dl className="flex flex-col gap-1">
              {PROFILE_NUTRIENT_ORDER.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-3 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium text-foreground">{formatAmount(profile, key)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex flex-col gap-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Full ingredient list
            </h4>
            {profile.ingredients.rawText ? (
              <p className="text-sm leading-relaxed text-foreground">{profile.ingredients.rawText}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Not available</p>
            )}
          </div>

          {understanding && (
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                All observations
              </h4>
              {[...understanding.ingredientInsights, ...understanding.nutritionInsights].map(
                (insight, i) => (
                  <div key={i} className="rounded-xl bg-muted/50 px-3 py-2">
                    <p className="text-sm font-medium text-foreground">{insight.label}</p>
                    {"evidence" in insight && insight.evidence && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Evidence: {insight.evidence}
                      </p>
                    )}
                  </div>
                ),
              )}
              {understanding.unavailable.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Unavailable: {understanding.unavailable.join(", ")}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
            <p>Source: {profile.source}</p>
            <p>
              Understanding:{" "}
              {profile.understandingSource === "qwen"
                ? "AI model"
                : profile.understandingSource === "mock"
                  ? "On-device descriptive summary"
                  : "Unavailable"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
