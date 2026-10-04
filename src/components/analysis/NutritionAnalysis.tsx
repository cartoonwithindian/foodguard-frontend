"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

type NutritionAnalysisProps = {
  title: string;
  labels: {
    calories: string;
    sugar: string;
    sodium: string;
    saturatedFat: string;
    totalFat?: string;
    salt?: string;
    protein: string;
    fibre: string;
    servingSize: string;
  };
  nutrition: {
    calories: number | string;
    sugar: string;
    sodium: string;
    saturatedFat: string;
    totalFat?: string;
    salt?: string;
    protein: string;
    fibre: string;
    servingSize: string;
  };
  barcode?: string;
  viewDetailsLabel?: string;
};

export function NutritionAnalysis({
  title,
  labels,
  nutrition,
  barcode,
  viewDetailsLabel,
}: NutritionAnalysisProps) {
  const rows = [
    { label: labels.servingSize, value: nutrition.servingSize, highlight: false },
    { label: labels.calories, value: String(nutrition.calories), highlight: false },
    { label: labels.sugar, value: nutrition.sugar, highlight: true },
    { label: labels.sodium, value: nutrition.sodium, highlight: true },
    { label: labels.saturatedFat, value: nutrition.saturatedFat, highlight: true },
    ...(labels.totalFat && nutrition.totalFat ? [{ label: labels.totalFat, value: nutrition.totalFat, highlight: true }] : []),
    ...(labels.salt && nutrition.salt ? [{ label: labels.salt, value: nutrition.salt, highlight: true }] : []),
    { label: labels.protein, value: nutrition.protein, highlight: false },
    { label: labels.fibre, value: nutrition.fibre, highlight: false },
  ];

  return (
    <div className="foodguard-card p-5">
      <h3 className="text-base font-semibold text-foreground mb-4">{title}</h3>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                Nutrient
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.label} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 text-foreground">{row.label}</td>
                <td
                  className={`px-4 py-2.5 text-right font-medium ${
                    row.highlight ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {barcode && viewDetailsLabel && (
        <Link
          href={`/nutrition?barcode=${encodeURIComponent(barcode)}`}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {viewDetailsLabel}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
