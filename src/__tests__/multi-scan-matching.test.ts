import { describe, it, expect, vi } from "vitest";
import {
  VisualSearchMatcher,
  matchStrengthFor,
  type ProductMatch,
} from "@/lib/multi-scan/matching";
import type { VisualSearchResponse } from "@/lib/visual-search";
import type {
  CapturedFrame,
  ProductDetection,
} from "@/lib/multi-scan/types";

const FRAME: CapturedFrame = {
  dataUrl: "data:image/jpeg;base64,xxx",
  width: 1280,
  height: 720,
  capturedAt: 1,
};

const det = (id: string, x = 0.1): ProductDetection => ({
  id,
  boundingBox: { x, y: 0.1, width: 0.2, height: 0.4 },
  confidence: 0.9,
  status: "detected",
});

const okResponse = (names: string[], scores: number[]): VisualSearchResponse => ({
  ok: true,
  query: "vector_search",
  results: names.map((productName, i) => ({
    rank: i + 1,
    productName,
    productId: `id-${productName}`,
    score: scores[i],
  })),
});

const errResponse = (serviceUnavailable: boolean): VisualSearchResponse => ({
  ok: false,
  serviceUnavailable,
  message: serviceUnavailable ? "unavailable" : "boom",
});

describe("matchStrengthFor", () => {
  it("tiers FAISS L2 distance honestly (lower = closer)", () => {
    expect(matchStrengthFor(20.5)).toBe("strong");
    expect(matchStrengthFor(23)).toBe("strong");
    expect(matchStrengthFor(28)).toBe("possible");
    expect(matchStrengthFor(32)).toBe("possible");
    expect(matchStrengthFor(45)).toBe("none");
    expect(matchStrengthFor(NaN)).toBe("none");
  });
});

describe("VisualSearchMatcher (mocked embed/search/crop)", () => {
  function harness(searchImpl: (vector: number[]) => Promise<VisualSearchResponse>) {
    const cropRects: Array<{ x: number; y: number; width: number; height: number }> = [];
    const embedded: string[] = [];
    const matcher = new VisualSearchMatcher({
      crop: async (_frame, rect) => {
        cropRects.push({ ...rect });
        const marker = `${rect.x},${rect.y}`;
        return { blob: new Blob([marker]), thumb: `thumb:${marker}` };
      },
      embed: async (blob: Blob) => {
        const marker = await blob.text();
        embedded.push(marker);
        return [marker.length];
      },
      search: (vector: number[]) => searchImpl(vector),
    });
    return { matcher, cropRects, embedded };
  }

  it("matches a single detection to top-K candidates", async () => {
    const { matcher } = harness(async () =>
      okResponse(["Corn Flakes", "Chocos", "Oats"], [20.5, 24.1, 26.7]),
    );
    const [m] = await matcher.match(FRAME, [det("d1")]);
    expect(m.detectionId).toBe("d1");
    expect(m.status).toBe("matched");
    expect(m.matchStrength).toBe("strong");
    expect(m.candidates).toHaveLength(3);
    expect(m.top?.productName).toBe("Corn Flakes");
    expect(m.top?.similarity).toBe(20.5);
    expect(m.cropImage).toBe("thumb:107,48");
    // Nothing confirmed automatically.
    expect(m.confirmedProductId).toBeNull();
  });

  it("marks distant top hits as weak_match with candidates for confirm", async () => {
    const { matcher } = harness(async () =>
      okResponse(["Brand A Cereal", "Brand B Cereal"], [28.4, 29.9]),
    );
    const [m] = await matcher.match(FRAME, [det("d1")]);
    expect(m.status).toBe("weak_match");
    expect(m.matchStrength).toBe("possible");
    expect(m.top?.productName).toBe("Brand A Cereal");
    expect(m.candidates).toHaveLength(2);
  });

  it("marks empty/far results as no_match without inventing identity", async () => {
    const { matcher } = harness(async () => okResponse([], []));
    const [empty] = await matcher.match(FRAME, [det("d1")]);
    expect(empty.status).toBe("no_match");
    expect(empty.top).toBeNull();

    const { matcher: far } = harness(async () =>
      okResponse(["Unrelated Item"], [58.2]),
    );
    const [m] = await far.match(FRAME, [det("d1")]);
    expect(m.status).toBe("no_match");
    expect(m.matchStrength).toBe("none");
  });

  it("searches each detection with its own crop (never the full frame)", async () => {
    const { matcher, cropRects, embedded } = harness(async (vector) =>
      okResponse([`Product-${vector[0]}`], [21.0]),
    );
    const matches = await matcher.match(FRAME, [det("d1", 0.05), det("d2", 0.55), det("d3", 0.75)]);
    expect(matches).toHaveLength(3);
    // Three distinct crop rects, three distinct embeddings searched.
    expect(new Set(cropRects.map((r) => `${r.x},${r.y}`)).size).toBe(3);
    expect(new Set(embedded).size).toBe(3);
    // Detection-to-product mapping is positional and stable.
    expect(matches.map((m) => m.detectionId)).toEqual(["d1", "d2", "d3"]);
    expect(matches[0].top?.productName).not.toBe(matches[1].top?.productName);
  });

  it("isolates one product failure while others succeed", async () => {
    const { matcher } = harness(async (vector) => {
      // d2's crop marker is longer (x=683 vs x=43) — fail only that product.
      if (vector[0] === "683,72".length) return errResponse(true);
      return okResponse(["Fine Product"], [20.1]);
    });
    const matches = await matcher.match(FRAME, [det("d1", 0.05), det("d2", 0.55)]);
    const byId = new Map(matches.map((m) => [m.detectionId, m]));
    expect(byId.get("d2")?.status).toBe("error");
    expect(byId.get("d2")?.error).toMatch(/unavailable/i);
    expect(byId.get("d1")?.status).toBe("matched");
  });

  it("streams progress per product without blocking the batch", async () => {
    const { matcher } = harness(async () => okResponse(["P"], [21.0]));
    const progress: Array<{ completed: number; total: number }> = [];
    const onProgress = vi.fn((p: { completed: number; total: number; matches: ProductMatch[] }) => {
      progress.push({ completed: p.completed, total: p.total });
    });
    await matcher.match(FRAME, [det("d1"), det("d2"), det("d3")], onProgress);
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(progress).toEqual([
      { completed: 1, total: 3 },
      { completed: 2, total: 3 },
      { completed: 3, total: 3 },
    ]);
  });

  it("handles invalid crops as per-product errors", async () => {
    const { matcher } = harness(async () => okResponse(["P"], [21.0]));
    const tiny: ProductDetection = {
      ...det("tiny"),
      boundingBox: { x: 0.5, y: 0.5, width: 0.005, height: 0.005 },
    };
    const [m] = await matcher.match(FRAME, [tiny]);
    expect(m.status).toBe("error");
    expect(m.error).toMatch(/too small/i);
  });
});

describe("CapturedFrame + ProductDetection[] → ProductMatch[] (integration)", () => {
  it("end-to-end mapping with mocked ML boundary", async () => {
    const matcher = new VisualSearchMatcher({
      crop: async () => ({ blob: new Blob(["x"]), thumb: "thumb" }),
      embed: async () => [1, 2, 3],
      search: async () => okResponse(["A", "B", "C"], [20.9, 25.0, 40.0]),
    });
    const matches = await matcher.match(FRAME, [det("d1"), det("d2")]);
    expect(matches).toHaveLength(2);
    for (const m of matches) {
      expect(m.status).toBe("matched");
      expect(m.candidates.map((c) => c.productName)).toEqual(["A", "B", "C"]);
      // Detection confidence and identification stay separate concepts.
      expect(m.top?.similarity).toBe(20.9);
      expect(m.confirmedProductId).toBeNull();
    }
  });
});
