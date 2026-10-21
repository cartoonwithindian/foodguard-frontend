/**
 * Multi-Product Scanner — personal comparison (Phase 5, Step 14).
 *
 * The one thing this component must never do is announce a universal winner.
 * It names a best only when the user has set a goal that defines one, and it
 * prints the note explaining what criterion was (or was not) used. With no
 * goal, the table still shows the numbers — it just refuses to rank.
 */
"use client";

import type { ProductComparison } from "@/lib/personalization/comparison";
import { cn } from "@/lib/utils";

function fmt(value: number | null, unit: string): string {
  if (value === null) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}${unit}`;
}

export function ComparisonTable({ comparison }: { comparison: ProductComparison }) {
  const { columns, rows, bestForGoalProductId, note, goalCriterion } = comparison;
  if (columns.length < 2) return null;

  return (
    <section
      aria-label="Compare products for your goal"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">
          {goalCriterion
            ? "Compared against your goal"
            : "Product comparison"}
        </h3>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Per-serving nutrition for each scanned product, marked against your stated goal.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-28 py-2 pr-3 text-left font-medium text-muted-foreground">
                Nutrient
              </th>
              {columns.map((c) => {
                const isBest = bestForGoalProductId === c.productId;
                return (
                  <th
                    key={c.productId}
                    scope="col"
                    className="py-2 pl-3 text-left font-medium text-foreground"
                  >
                    <span className="block max-w-[9rem] truncate">{c.productName}</span>
                    {isBest && (
                      <span className="mt-0.5 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                        Best for your goal
                      </span>
                    )}
                    {c.hardConstraintViolation && (
                      <span className="mt-0.5 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-900 dark:bg-red-950 dark:text-red-100">
                        Conflicting
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-border">
                <th
                  scope="row"
                  className="py-2 pr-3 text-left font-normal text-muted-foreground"
                >
                  {row.label}
                  {row.bestIndex !== null && (
                    <span className="block text-[10px] text-muted-foreground">
                      lower is better
                    </span>
                  )}
                  {row.unavailableReason && (
                    <span className="block text-[10px] text-muted-foreground">
                      not reported
                    </span>
                  )}
                </th>
                {row.values.map((v, i) => (
                  <td
                    key={`${row.key}-${i}`}
                    className={cn(
                      "py-2 pl-3 tabular-nums",
                      v === null
                        ? "text-muted-foreground"
                        : i === row.bestIndex
                          ? "font-semibold text-foreground"
                          : "text-foreground",
                    )}
                  >
                    {v === null ? "Not available" : fmt(v, row.unit)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {comparison.conflictingProductIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Conflicting products are shown for reference but are never ranked.
        </p>
      )}
    </section>
  );
}
