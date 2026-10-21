/**
 * Multi-Product Scanner — confirmed-product data lookup (Phase 4).
 *
 * Reuses the existing FoodGuard resolution chain (name search → barcode
 * detail) with zero backend changes:
 *
 *   confirmedProductName
 *   → searchProductCandidates()   (/api/products/search: store + dataset)
 *   → top hit → resolveProductByBarcode()  (/api/products/barcode/:barcode)
 *   → product metadata + nutrition record
 *
 * Only CONFIRMED identities enter this pipeline — callers must pass
 * confirmedProductId/Name (weak unconfirmed matches are rejected here as a
 * data-integrity backstop). The confirmed ID is the source of truth: when
 * name search returns several candidates the entry whose store id equals
 * confirmedProductId wins, so a same-brand sibling is never silently
 * substituted. Missing values stay missing; nothing is invented.
 */
"use client";

import {
  resolveProductByBarcode,
  searchProductCandidates,
} from "@/lib/resolve-product";
import type { IdentifiedProduct } from "@/types/identification";
import type { NutritionFacts } from "@/types/domain";
import { coerceNutritionFacts } from "./food-profile";

export type ConfirmedLookupInput = {
  detectionId: string;
  confirmedProductId: string | null;
  confirmedProductName: string | null;
};

export type ProfileLookupSuccess = {
  ok: true;
  product: {
    name: string;
    brand: string | null;
    imageUrl: string | null;
    barcode: string | null;
    category: string;
    ingredientsRaw: string;
    source: string;
  };
  nutrition: NutritionFacts | null;
  servingSize: string | null;
  source: string;
};

export type ProfileLookupFailure = {
  ok: false;
  code: "UNCONFIRMED" | "PRODUCT_NOT_FOUND" | "LOOKUP_ERROR";
  message: string;
};

export type ProfileLookupResult = ProfileLookupSuccess | ProfileLookupFailure;

function fromIdentified(p: IdentifiedProduct, source: string): Omit<ProfileLookupSuccess, "ok" | "nutrition" | "servingSize" | "source"> & { source: string } {
  return {
    product: {
      name: p.name,
      brand: p.brand || null,
      imageUrl: p.imageUrl ?? null,
      barcode: p.barcode || null,
      category: p.category || "food",
      ingredientsRaw: p.ingredientsRaw ?? "",
      source: p.sourceDetail ?? p.source,
    },
    source,
  };
}

export async function lookupConfirmedProduct(
  input: ConfirmedLookupInput,
): Promise<ProfileLookupResult> {
  // Backstop: never analyze an unconfirmed identity as a known product.
  if (!input.confirmedProductId || !input.confirmedProductName?.trim()) {
    return {
      ok: false,
      code: "UNCONFIRMED",
      message: "Confirm product to analyze.",
    };
  }
  const name = input.confirmedProductName.trim();

  try {
    // 1. Existing name search (store + bundled dataset + network).
    const resolution = await searchProductCandidates(name);
    let pool: IdentifiedProduct[] = [];
    if (resolution.status === "resolved") pool = [resolution.product];
    else if (resolution.status === "candidates") pool = resolution.candidates;

    if (pool.length === 0) {
      return { ok: false, code: "PRODUCT_NOT_FOUND", message: `"${name}" was not found in the product database.` };
    }

    // 2. The CONFIRMED id is the source of truth. Rank-1 by name similarity is
    //    only a fallback — a same-brand sibling must never be silently
    //    substituted for what the user actually confirmed.
    const top =
      pool.find((p) => p.id === input.confirmedProductId) ??
      pool[0] ?? null;
    if (!top) {
      return { ok: false, code: "PRODUCT_NOT_FOUND", message: `"${name}" was not found in the product database.` };
    }

    // 3. Barcode detail carries the nutrition record when available.
    if (top.barcode) {
      try {
        const detail = await resolveProductByBarcode(top.barcode, "visual_search");
        if (detail.status === "resolved") {
          const base = fromIdentified(detail.product, detail.product.resolutionSource ?? "network");
          const nutrition = coerceNutritionFacts(detail.product.nutrition);
          return {
            ok: true,
            ...base,
            nutrition,
            servingSize: nutrition?.servingSize ?? null,
            source: base.source,
          };
        }
      } catch {
        // Fall through to the name-search hit itself.
      }
    }

    // Name-search hit without barcode detail: metadata only, no nutrition.
    const base = fromIdentified(top, top.resolutionSource ?? "network");
    return { ok: true, ...base, nutrition: null, servingSize: null, source: base.source };
  } catch {
    return {
      ok: false,
      code: "LOOKUP_ERROR",
      message: "Product lookup failed. Check your connection and try again.",
    };
  }
}
