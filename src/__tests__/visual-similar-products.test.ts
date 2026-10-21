import { describe, it, expect, vi, afterEach } from "vitest";
import {
  resolveProductByPhoto,
  resolveProductByImageUrl,
} from "@/lib/resolve-product";

/**
 * The hosted CLIP+FAISS service already returned `similarProducts` from
 * `/api/scan/label`, but the client ignored the field, so uploading a photo of
 * a real product with no readable barcode or OCR text always degraded to
 * `not_found` and the user saw an empty list. These tests pin the consumption
 * of that field plus the new image-link path.
 */

const visualHit = (overrides: Partial<{
  rank: number;
  productName: string;
  productId: string;
  score: number;
}> = {}) => ({
  rank: 1,
  productName: "Bisk Farm Rich Marie Biscuits",
  productId: "Bisk Farm Rich Marie Biscuits_7043",
  score: 2.04,
  ...overrides,
});

/** A scan/label response with no barcode and no usable OCR text. */
const unlabeledScan = (similarProducts: unknown[]) => ({
  ok: true,
  status: 200,
  json: async () => ({
    success: true,
    barcode: { value: null, format: null, status: "not_found" },
    ocr: { text: "", status: "not_found", confidence: 0, needsReview: false, provider: "none" },
    sources: ["visual_search"],
    similarProducts,
  }),
});

const stubScanLabel = (payload: ReturnType<typeof unlabeledScan>) => {
  const stub = vi.fn();
  stub.mockImplementation((url: RequestInfo | URL) => {
    const path = String(url);
    if (path === "/api/scan/label") return Promise.resolve(payload);
    // Catalog/name lookup must miss so the visual fallback is exercised.
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { products: [], total: 0 } }),
    });
  });
  vi.stubGlobal("fetch", stub);
  return stub;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("similar products from a photo upload", () => {
  it("offers visually similar products as candidates when nothing is readable", async () => {
    stubScanLabel(
      unlabeledScan([
        visualHit(),
        visualHit({ rank: 2, productName: "Bisk Farm Rich Marie 250g", productId: "rich-marie-250g", score: 28.34 }),
        visualHit({ rank: 3, productName: "Britannia Marie Gold Biscuits, 200g", productId: "britannia-marie", score: 32.37 }),
      ]),
    );

    const { resolution } = await resolveProductByPhoto(
      new Blob(["fake-image"], { type: "image/jpeg" }),
    );

    expect(resolution.status).toBe("candidates");
    if (resolution.status === "candidates") {
      expect(resolution.candidates).toHaveLength(3);
      expect(resolution.candidates[0].name).toBe("Bisk Farm Rich Marie Biscuits");
      expect(resolution.candidates[0].id).toBe("Bisk Farm Rich Marie Biscuits_7043");
    }
  });

  it("orders candidates best-match-first and never reports 100% confidence", async () => {
    stubScanLabel(
      unlabeledScan([
        visualHit({ rank: 1, productName: "Exact Match", productId: "exact", score: 0.01 }),
        visualHit({ rank: 2, productName: "Weak Match", productId: "weak", score: 40 }),
      ]),
    );

    const { resolution } = await resolveProductByPhoto(
      new Blob(["fake-image"], { type: "image/jpeg" }),
    );

    if (resolution.status === "candidates") {
      expect(resolution.candidates.map((c) => c.name)).toEqual(["Exact Match", "Weak Match"]);
      for (const candidate of resolution.candidates) {
        expect(candidate.confidence).toBeLessThanOrEqual(0.95);
        expect(candidate.confidence).toBeGreaterThan(0);
      }
    }
  });

  it("resolves directly when the service returns a single visual match", async () => {
    stubScanLabel(unlabeledScan([visualHit()]));

    const { resolution } = await resolveProductByPhoto(
      new Blob(["fake-image"], { type: "image/jpeg" }),
    );

    expect(resolution.status).toBe("resolved");
    if (resolution.status === "resolved") {
      expect(resolution.product.name).toBe("Bisk Farm Rich Marie Biscuits");
    }
  });

  it("still reports not_found when the service finds nothing at all", async () => {
    stubScanLabel(unlabeledScan([]));

    const { resolution } = await resolveProductByPhoto(
      new Blob(["fake-image"], { type: "image/jpeg" }),
    );

    expect(resolution.status).toBe("not_found");
  });

  it("keeps visual matches out of the way when OCR text already matches a product", async () => {
    const stub = vi.fn();
    stub.mockImplementation((url: RequestInfo | URL) => {
      const path = String(url);
      if (path === "/api/scan/label") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            barcode: { value: null, format: null, status: "not_found" },
            ocr: { text: "Kurkure Masala Munch", status: "success", confidence: 0.9, needsReview: false, provider: "tesseract" },
            sources: ["visual_search"],
            similarProducts: [visualHit(), visualHit({ rank: 2, productId: "other" })],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            products: [
              { id: "p1", barcode: "8901491100519", name: "Kurkure Masala Munch", brand: "Kurkure", category: "food", imageUrl: null, score: 95 },
            ],
            total: 1,
          },
        }),
      });
    });
    vi.stubGlobal("fetch", stub);

    const { resolution } = await resolveProductByPhoto(
      new Blob(["fake-image"], { type: "image/jpeg" }),
    );

    expect(resolution.status).toBe("resolved");
    if (resolution.status === "resolved") {
      expect(resolution.product.name).toBe("Kurkure Masala Munch");
    }
  });
});

describe("resolveProductByImageUrl", () => {
  it("maps image-link results into candidates", async () => {
    const stub = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          results: [visualHit(), visualHit({ rank: 2, productName: "Bisk Farm Rich Marie 250g", productId: "rich-marie-250g", score: 28.34 })],
          query: "image_url_search",
        },
        error: null,
      }),
    });
    vi.stubGlobal("fetch", stub);

    const url = "https://cdn.example.com/products/biscuits.jpg";
    const resolution = await resolveProductByImageUrl(url);

    expect(resolution.status).toBe("candidates");
    if (resolution.status === "candidates") {
      expect(resolution.candidates).toHaveLength(2);
      expect(resolution.extracted?.imageUrl).toBe(url);
    }
    const [, init] = stub.mock.calls[0];
    expect(JSON.parse(String(init.body))).toEqual({ image_url: url, top_k: 8 });
  });

  it("rejects a non-http link before hitting the network", async () => {
    const stub = vi.fn();
    vi.stubGlobal("fetch", stub);

    const resolution = await resolveProductByImageUrl("not-a-url");

    expect(resolution.status).toBe("error");
    expect(stub).not.toHaveBeenCalled();
  });

  it("surfaces the service error message when the link cannot be searched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          success: false,
          data: null,
          error: { code: "VISUAL_SEARCH_ERROR", message: "That URL is not a reachable image." },
        }),
      }),
    );

    const resolution = await resolveProductByImageUrl("https://example.com/not-an-image");

    expect(resolution.status).toBe("error");
    if (resolution.status === "error") {
      expect(resolution.message).toBe("That URL is not a reachable image.");
    }
  });

  it("reports not_found when the link has no similar products", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { results: [], query: "image_url_search" },
          error: null,
        }),
      }),
    );

    const resolution = await resolveProductByImageUrl("https://example.com/photo.jpg");
    expect(resolution.status).toBe("not_found");
  });
});