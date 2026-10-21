import { describe, it, expect } from "vitest";
import {
  toNormalizedDetections,
  applyConfidenceFilter,
  type RawModelDetection,
} from "@/lib/multi-scan/normalize";

const W = 1280;
const H = 720;

const raw = (
  label: string,
  score: number,
  box: [number, number, number, number],
): RawModelDetection => ({
  label,
  score,
  box: { xmin: box[0], ymin: box[1], xmax: box[2], ymax: box[3] },
});

describe("toNormalizedDetections", () => {
  it("normalizes one product detection to 0–1 coordinates", () => {
    const [d] = toNormalizedDetections([raw("bottle", 0.92, [128, 72, 512, 648])], W, H);
    expect(d).toBeDefined();
    expect(d.boundingBox).toEqual({
      x: 128 / W,
      y: 72 / H,
      width: (512 - 128) / W,
      height: (648 - 72) / H,
    });
    expect(d.confidence).toBe(0.92);
    expect(d.status).toBe("detected");
    expect(d.productName).toBeUndefined();
    expect(d.nutrition).toBeUndefined();
  });

  it("detects multiple products, sorted by confidence desc", () => {
    const out = toNormalizedDetections(
      [
        raw("cup", 0.71, [700, 100, 900, 400]),
        raw("bottle", 0.94, [100, 100, 300, 600]),
        raw("apple", 0.83, [400, 200, 600, 500]),
      ],
      W,
      H,
    );
    expect(out).toHaveLength(3);
    expect(out.map((d) => d.confidence)).toEqual([0.94, 0.83, 0.71]);
    // Every detection gets a unique id.
    expect(new Set(out.map((d) => d.id)).size).toBe(3);
  });

  it("returns [] for empty model output", () => {
    expect(toNormalizedDetections([], W, H)).toEqual([]);
  });

  it("drops below-threshold detections (configurable)", () => {
    const hits = [raw("bottle", 0.9, [0, 0, 100, 100]), raw("cup", 0.4, [0, 0, 100, 100])];
    expect(toNormalizedDetections(hits, W, H, { threshold: 0.5 })).toHaveLength(1);
    expect(toNormalizedDetections(hits, W, H, { threshold: 0.3 })).toHaveLength(2);
  });

  it("excludes non-product classes (person, chair, tv…)", () => {
    const out = toNormalizedDetections(
      [
        raw("person", 0.99, [0, 0, 200, 600]),
        raw("chair", 0.95, [300, 300, 600, 700]),
        raw("bottle", 0.9, [700, 100, 900, 600]),
      ],
      W,
      H,
    );
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("bottle");
  });

  it("caps results at maxResults, keeping the most confident", () => {
    const hits = Array.from({ length: 15 }, (_, i) =>
      raw("bottle", 0.99 - i * 0.01, [i * 10, 0, i * 10 + 50, 100]),
    );
    const out = toNormalizedDetections(hits, W, H, { maxResults: 5 });
    expect(out).toHaveLength(5);
    expect(out[0].confidence).toBeCloseTo(0.99);
  });

  it("clamps out-of-range boxes and drops degenerate ones", () => {
    const out = toNormalizedDetections(
      [raw("bottle", 0.9, [-50, -20, 2000, 900])],
      W,
      H,
    );
    expect(out).toHaveLength(1);
    expect(out[0].boundingBox.x).toBe(0);
    expect(out[0].boundingBox.y).toBe(0);
    expect(out[0].boundingBox.width).toBeLessThanOrEqual(1);
    expect(out[0].boundingBox.height).toBeLessThanOrEqual(1);
  });

  it("ignores malformed detector output without throwing", () => {
    const malformed: unknown[] = [
      null,
      undefined,
      "bottle",
      42,
      { label: "bottle" },
      { label: "bottle", score: "high", box: { xmin: 0, ymin: 0, xmax: 1, ymax: 1 } },
      { label: "bottle", score: 0.9, box: null },
      { label: "bottle", score: 0.9, box: { xmin: 5, ymin: 5, xmax: 5, ymax: 5 } },
      { label: "bottle", score: 0.9, box: { xmin: 10, ymin: 10, xmax: 2, ymax: 2 } },
      { label: "bottle", score: NaN, box: { xmin: 0, ymin: 0, xmax: 1, ymax: 1 } },
    ];
    expect(toNormalizedDetections(malformed, W, H)).toEqual([]);
    expect(toNormalizedDetections("not-an-array", W, H)).toEqual([]);
    expect(toNormalizedDetections([raw("bottle", 0.9, [0, 0, 10, 10])], 0, H)).toEqual([]);
  });
});

describe("applyConfidenceFilter", () => {
  it("re-filters without re-running the model", () => {
    const dets = toNormalizedDetections(
      [raw("bottle", 0.9, [0, 0, 100, 100]), raw("cup", 0.6, [0, 0, 100, 100])],
      W,
      H,
      { threshold: 0.5 },
    );
    expect(applyConfidenceFilter(dets, 0.8)).toHaveLength(1);
    expect(applyConfidenceFilter(dets, 0.5)).toHaveLength(2);
  });
});
