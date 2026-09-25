"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Barcode,
  Package,
} from "lucide-react";
import type { CatalogProductItem } from "@/lib/store/sqlite";

type ProductCardProps = {
  product: CatalogProductItem;
  viewAnalysisLabel?: string;
  noImageLabel?: string;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ProductCard({
  product,
  viewAnalysisLabel = "View Analysis",
  noImageLabel = "No image",
}: ProductCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const analysisHref = product.hasBarcode
    ? `/analysis?barcode=${encodeURIComponent(product.barcode)}`
    : `/analysis?productName=${encodeURIComponent(product.name)}`;

  return (
    <Link
      href={analysisHref}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Image */}
      <div className="relative flex h-40 items-center justify-center bg-muted/40">
        {product.imageUrl && !imageFailed ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <span className="flex size-14 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
              {initials(product.name)}
            </span>
            <span className="text-xs">{noImageLabel}</span>
          </div>
        )}

        {product.category && (
          <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur-sm">
            {product.categoryLabel}
          </span>
        )}
        {product.verified && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            <BadgeCheck className="size-3" aria-hidden="true" />
            Verified
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
            {product.name}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {product.brand && <span>{product.brand}</span>}
            {product.packSize && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Package className="size-3" aria-hidden="true" />
                  {product.packSize}
                </span>
              </>
            )}
          </div>
        </div>

        {product.hasBarcode && (
          <p className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <Barcode className="size-3.5" aria-hidden="true" />
            {product.barcode}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center gap-1.5">
            {product.hasNutrition && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Nutrition
              </span>
            )}
            {product.hasIngredients && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Ingredients
              </span>
            )}
            {!product.hasNutrition && !product.hasIngredients && (
              <span className="text-xs text-muted-foreground">Basic data</span>
            )}
          </div>

          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors group-hover:text-primary/80 group-hover:underline">
            {viewAnalysisLabel}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}