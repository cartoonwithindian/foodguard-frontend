import { describe, it, expect } from "vitest";
import { cropRectForDetection } from "@/lib/multi-scan/crop";
import type { BoundingBox } from "@/lib/multi-scan/types";

const W = 1280;
const H = 720;
const box = (x: number, y: number, w: number, h: number): BoundingBox => ({
  x,
  y,
  width: w,
  height: h,
});

describe("cropRectForDetection", () => {
  it("converts a normalized box to source-image pixels with padding", () => {
    // Spec example: x=0.20 y=0.10 w=0.25 h=0.50, 8% padding.
    const rect = cropRectForDetection(W, H, box(0.2, 0.1, 0.25, 0.5));
    expect(rect).not.toBeNull();
    // Base pixels: x 256→576, y 72→432; padding expands each side.
    expect(rect!.x).toBeLessThanOrEqual(256);
    expect(rect!.y).toBeLessThanOrEqual(72);
    expect(rect!.x + rect!.width).toBeGreaterThanOrEqual(576);
    expect(rect!.y + rect!.height).toBeGreaterThanOrEqual(432);
    expect(rect!.width).toBeLessThanOrEqual(W);
    expect(rect!.height).toBeLessThanOrEqual(H);
  });

  it("produces separate crops per detection", () => {
    const a = cropRectForDetection(W, H, box(0.05, 0.1, 0.2, 0.5), { padding: 0 });
    const b = cropRectForDetection(W, H, box(0.6, 0.1, 0.2, 0.5), { padding: 0 });
    expect(a).toEqual({ x: 64, y: 72, width: 256, height: 360 });
    expect(b).toEqual({ x: 768, y: 72, width: 256, height: 360 });
    expect(a).not.toEqual(b);
  });

  it("clamps detections near the image boundary", () => {
    const rect = cropRectForDetection(W, H, box(0.85, 0.8, 0.2, 0.3));
    expect(rect).not.toBeNull();
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(W);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(H);
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.y).toBeGreaterThanOrEqual(0);
  });

  it("rejects invalid bounding boxes", () => {
    expect(cropRectForDetection(W, H, box(0.1, 0.1, 0, 0.2))).toBeNull();
    expect(cropRectForDetection(W, H, box(0.1, 0.1, -0.2, 0.2))).toBeNull();
    expect(
      cropRectForDetection(W, H, { x: NaN, y: 0, width: 0.2, height: 0.2 }),
    ).toBeNull();
    expect(cropRectForDetection(0, H, box(0.1, 0.1, 0.2, 0.2))).toBeNull();
    expect(cropRectForDetection(W, 0, box(0.1, 0.1, 0.2, 0.2))).toBeNull();
  });

  it("rejects tiny detections", () => {
    // 10×7 px region on a 1280×720 frame.
    expect(cropRectForDetection(W, H, box(0.5, 0.5, 0.008, 0.01))).toBeNull();
  });

  it("padding is configurable", () => {
    const padded = cropRectForDetection(W, H, box(0.3, 0.3, 0.2, 0.2));
    const tight = cropRectForDetection(W, H, box(0.3, 0.3, 0.2, 0.2), { padding: 0 });
    expect(tight).toEqual({
      x: Math.floor(0.3 * W),
      y: Math.floor(0.3 * H),
      width: Math.ceil(0.5 * W) - Math.floor(0.3 * W),
      height: Math.ceil(0.5 * H) - Math.floor(0.3 * H),
    });
    expect(padded!.width).toBeGreaterThan(tight!.width);
  });
});
