import { describe, it, expect } from "vitest";
import {
  computeContainRect,
  toScreenBox,
  toPercentBox,
} from "@/lib/multi-scan/geometry";
import type { BoundingBox } from "@/lib/multi-scan/types";

const BOX: BoundingBox = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };

describe("computeContainRect", () => {
  it("same aspect ratio fills the viewport exactly", () => {
    // 1280×720 image in a 1280×720 viewport.
    const rect = computeContainRect(1280, 720, 1280, 720);
    expect(rect).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
  });

  it("wider image than viewport letterboxes vertically", () => {
    // 1280×720 (16:9) image in a 400×400 square viewport.
    const rect = computeContainRect(1280, 720, 400, 400);
    expect(rect.width).toBeCloseTo(400);
    expect(rect.height).toBeCloseTo(225);
    expect(rect.x).toBeCloseTo(0);
    expect(rect.y).toBeCloseTo((400 - 225) / 2);
  });

  it("taller image than viewport pillarboxes horizontally", () => {
    // 720×1280 portrait image in a 1280×720 landscape viewport.
    const rect = computeContainRect(720, 1280, 1280, 720);
    expect(rect.height).toBeCloseTo(720);
    expect(rect.width).toBeCloseTo(405);
    expect(rect.y).toBeCloseTo(0);
    expect(rect.x).toBeCloseTo((1280 - 405) / 2);
  });

  it("mobile portrait: camera landscape frame fits width", () => {
    // 1280×720 frame on a 390×700 phone viewport.
    const rect = computeContainRect(1280, 720, 390, 700);
    expect(rect.width).toBeCloseTo(390);
    expect(rect.height).toBeCloseTo(390 * (720 / 1280));
    expect(rect.x).toBeCloseTo(0);
    expect(rect.y).toBeGreaterThan(0);
  });

  it("desktop landscape: frame scales up, stays centered", () => {
    // 1280×720 frame in a 1200×600 desktop card.
    const rect = computeContainRect(1280, 720, 1200, 600);
    const scale = Math.min(1200 / 1280, 600 / 720);
    expect(rect.width).toBeCloseTo(1280 * scale);
    expect(rect.height).toBeCloseTo(720 * scale);
    expect(rect.x).toBeCloseTo((1200 - 1280 * scale) / 2);
    expect(rect.y).toBeCloseTo((600 - 720 * scale) / 2);
  });

  it("returns a zero rect for degenerate inputs", () => {
    expect(computeContainRect(0, 720, 400, 400)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(computeContainRect(1280, 720, 0, 400)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(computeContainRect(NaN, 720, 400, 400)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe("toScreenBox", () => {
  it("maps a centered normalized box through letterboxing", () => {
    const rect = computeContainRect(1280, 720, 400, 400);
    const screen = toScreenBox(BOX, rect);
    // Image paints at y≈87.5, height 225 → box center must land mid-image.
    expect(screen.left).toBeCloseTo(rect.x + 0.25 * rect.width);
    expect(screen.top).toBeCloseTo(rect.y + 0.25 * rect.height);
    expect(screen.width).toBeCloseTo(0.5 * rect.width);
    expect(screen.height).toBeCloseTo(0.5 * rect.height);
    // Box stays inside the painted image, not the full container.
    expect(screen.top).toBeGreaterThanOrEqual(rect.y);
    expect(screen.top + screen.height).toBeLessThanOrEqual(rect.y + rect.height);
  });

  it("maps full-frame box to the full painted rect", () => {
    const rect = computeContainRect(720, 1280, 1280, 720);
    const screen = toScreenBox({ x: 0, y: 0, width: 1, height: 1 }, rect);
    expect(screen).toEqual({ left: rect.x, top: rect.y, width: rect.width, height: rect.height });
  });
});

describe("toPercentBox", () => {
  it("converts normalized coords to overlay percentages", () => {
    expect(toPercentBox(BOX)).toEqual({
      leftPct: 25,
      topPct: 25,
      widthPct: 50,
      heightPct: 50,
    });
  });
});
