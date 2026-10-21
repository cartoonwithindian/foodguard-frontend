"use client";

import { AlertTriangle, ShieldAlert, Factory, HelpCircle } from "lucide-react";
import type { AllergenMatch } from "@/types/domain";

type AllergensSectionProps = {
  title: string;
  /** Declared allergens; `undefined` when the source data has no allergen info. */
  allergens: AllergenMatch[] | undefined;
};

const TYPE_PRESENTATION: Record<
  AllergenMatch["type"],
  { icon: typeof AlertTriangle; tone: string; label: string }
> = {
  contains: {
    icon: AlertTriangle,
    tone: "bg-status-high-risk/10 text-status-high-risk",
    label: "Contains",
  },
  may_contain: {
    icon: ShieldAlert,
    tone: "bg-status-moderate/10 text-status-moderate",
    label: "May contain",
  },
  processed_in_facility: {
    icon: Factory,
    tone: "bg-status-concern/10 text-status-concern",
    label: "Processed in a facility with",
  },
};

/**
 * Allergen declarations from the real analysis pipeline (`meta.allergens`).
 *
 * The three declaration types carry different meanings and are shown with
 * their own wording — a "may contain" precaution is never presented as a
 * confirmed "contains". When the backend returned no allergen data at all we
 * say information is unavailable instead of claiming "no allergens".
 */
export function AllergensSection({ title, allergens }: AllergensSectionProps) {
  return (
    <section className="foodguard-card p-5 sm:p-6" aria-labelledby="allergens-heading">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-status-high-risk" aria-hidden="true" />
        <h3 id="allergens-heading" className="text-base font-semibold text-foreground">
          {title}
        </h3>
      </div>

      {allergens === undefined || allergens === null ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <HelpCircle className="size-4 shrink-0" aria-hidden="true" />
          Allergen information unavailable for this product.
        </p>
      ) : allergens.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No allergens were detected in the available product information.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {allergens.map((match) => {
            const presentation = TYPE_PRESENTATION[match.type] ?? TYPE_PRESENTATION.contains;
            const Icon = presentation.icon;
            const name = match.allergen.replace(/_/g, " ");
            return (
              <li
                key={`${match.allergen}-${match.type}-${match.evidence}`}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${presentation.tone}`}
                title={match.evidence}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="capitalize">{name}</span>
                <span className="text-xs font-medium opacity-80">· {presentation.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
