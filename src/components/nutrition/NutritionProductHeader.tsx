"use client";

import { CATEGORY_LABELS } from "@/data/product-display";
import type { NutritionProductDetail } from "@/data/nutrition-data";
import type { NutritionLabels } from "@/data/nutrition-labels";

type NutritionProductHeaderProps = {
  product: NutritionProductDetail;
  labels: NutritionLabels["product"];
};

export function NutritionProductHeader({
  product,
  labels,
}: NutritionProductHeaderProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
          {product.brand.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">{product.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {product.brand} &middot; {CATEGORY_LABELS[product.category]}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{labels.servingSize}: {product.servingSize}</span>
            <span>{labels.scanDate}: {product.scanDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
