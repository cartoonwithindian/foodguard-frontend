"use client";

import { useState } from "react";
import { ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import type { ProductCategory } from "@/data/mock-data";
import { CATEGORY_LABELS } from "@/data/mock-data";

type ProductHeaderProps = {
  name: string;
  brand: string;
  category: ProductCategory;
  barcode: string;
  scanDate: string;
  imageUrl?: string;
  backButton: string;
  scanDateLabel: string;
};

export function ProductHeader({
  name,
  brand,
  category,
  barcode,
  scanDate,
  imageUrl,
  backButton,
  scanDateLabel,
}: ProductHeaderProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
  return (
    <div className="foodguard-card flex flex-col gap-4 p-5 sm:p-6">
      <Link
        href="/scan"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {backButton}
      </Link>
      <div className="flex gap-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-secondary">
          {imageUrl && !imageFailed ? (
            <img
              src={imageUrl}
              alt={name}
              className="size-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="text-lg font-semibold text-muted-foreground">
              {initials || "?"}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{name}</h1>
          <p className="text-sm text-muted-foreground">
            {brand} · {CATEGORY_LABELS[category]}
          </p>
          {barcode && (
            <p className="text-xs text-muted-foreground font-mono">{barcode}</p>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Clock className="size-3" aria-hidden="true" />
            {scanDateLabel}: {scanDate}
          </div>
        </div>
      </div>
    </div>
  );
}
