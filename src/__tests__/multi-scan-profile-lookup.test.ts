import { describe, it, expect, vi, beforeEach } from "vitest";

const searchProductCandidates = vi.fn();
const resolveProductByBarcode = vi.fn();

vi.mock("@/lib/resolve-product", () => ({
  searchProductCandidates: (...args: unknown[]) => searchProductCandidates(...args),
  resolveProductByBarcode: (...args: unknown[]) => resolveProductByBarcode(...args),
}));

import { lookupConfirmedProduct } from "@/lib/multi-scan/profile-lookup";

const product = (id: string, name: string, barcode = "") => ({
  id,
  barcode,
  name,
  brand: "Kellogg's",
  category: "food",
  ingredientsRaw: "Corn, sugar",
  source: "name_search",
  sourceDetail: "store",
  imageUrl: null,
});

const CONFIRMED = {
  detectionId: "d1",
  confirmedProductId: "sku-real",
  confirmedProductName: "Corn Flakes",
};

describe("lookupConfirmedProduct", () => {
  beforeEach(() => {
    searchProductCandidates.mockReset();
    resolveProductByBarcode.mockReset();
  });

  it("rejects unconfirmed identities as a data-integrity backstop", async () => {
    for (const bad of [
      { detectionId: "d1", confirmedProductId: null, confirmedProductName: "Corn Flakes" },
      { detectionId: "d1", confirmedProductId: "sku", confirmedProductName: null },
      { detectionId: "d1", confirmedProductId: "sku", confirmedProductName: "   " },
    ]) {
      const out = await lookupConfirmedProduct(bad);
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.code).toBe("UNCONFIRMED");
    }
    expect(searchProductCandidates).not.toHaveBeenCalled();
  });

  it("prefers the confirmed store id over a higher-ranked name match", async () => {
    // Rank-1 by name similarity is a DIFFERENT sibling product.
    searchProductCandidates.mockResolvedValue({
      status: "candidates",
      candidates: [product("sku-sibling", "Corn Flakes Extra Honey"), product("sku-real", "Corn Flakes")],
    });

    const out = await lookupConfirmedProduct(CONFIRMED);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.product.name).toBe("Corn Flakes");
  });

  it("falls back to rank-1 when no candidate carries the confirmed id", async () => {
    searchProductCandidates.mockResolvedValue({
      status: "candidates",
      candidates: [product("other", "Corn Flakes")],
    });
    const out = await lookupConfirmedProduct(CONFIRMED);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.product.name).toBe("Corn Flakes");
  });

  it("fetches nutrition from barcode detail when available", async () => {
    searchProductCandidates.mockResolvedValue({
      status: "candidates",
      candidates: [product("sku-real", "Corn Flakes", "123456")],
    });
    resolveProductByBarcode.mockResolvedValue({
      status: "resolved",
      product: {
        ...product("sku-real", "Corn Flakes", "123456"),
        nutrition: {
          servingSize: "30g",
          basis: "PER_100G",
          nutrients: { sugars: { value: 12, unit: "g", confidence: 0.8 } },
        },
        resolutionSource: "network",
      },
    });

    const out = await lookupConfirmedProduct(CONFIRMED);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.nutrition?.basis).toBe("PER_100G");
      expect(out.servingSize).toBe("30g");
    }
  });

  it("degrades to metadata-only (no invented nutrition) when barcode detail fails", async () => {
    searchProductCandidates.mockResolvedValue({
      status: "candidates",
      candidates: [product("sku-real", "Corn Flakes", "123456")],
    });
    resolveProductByBarcode.mockRejectedValue(new Error("offline"));

    const out = await lookupConfirmedProduct(CONFIRMED);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.nutrition).toBeNull();
      expect(out.servingSize).toBeNull();
    }
  });

  it("returns structured failures instead of throwing", async () => {
    searchProductCandidates.mockResolvedValue({ status: "candidates", candidates: [] });
    const missing = await lookupConfirmedProduct(CONFIRMED);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("PRODUCT_NOT_FOUND");

    searchProductCandidates.mockRejectedValue(new Error("boom"));
    const failed = await lookupConfirmedProduct(CONFIRMED);
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.code).toBe("LOOKUP_ERROR");
  });
});
