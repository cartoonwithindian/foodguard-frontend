/**
 * Multi-Product Scanner — normalized ↔ screen coordinate mapping (Phase 2).
 *
 * Canonical detection coordinates are normalized (0–1). The review image is
 * rendered with `object-contain`, so the displayed image is letterboxed /
 * pillarboxed inside its container. These pure helpers compute the rendered
 * image rect and convert normalized boxes to screen pixels — the overlay
 * never assumes camera dimensions == viewport dimensions.
 */
import type { BoundingBox } from "./types";

/** Rendered image rect (px) inside its container. */
export type RenderedImageRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Screen-space box (px, relative to the container). */
export type ScreenBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function isPositiveFinite(n: number): boolean {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Where an `object-contain` image actually paints inside a container:
 * uniform scale = min(cw/iw, ch/ih), centered with letterbox/pillarbox.
 * Returns a zero rect for degenerate inputs (caller renders no boxes).
 */
export function computeContainRect(
  naturalWidth: number,
  naturalHeight: number,
  containerWidth: number,
  containerHeight: number,
): RenderedImageRect {
  if (
    !isPositiveFinite(naturalWidth) ||
    !isPositiveFinite(naturalHeight) ||
    !isPositiveFinite(containerWidth) ||
    !isPositiveFinite(containerHeight)
  ) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const scale = Math.min(
    containerWidth / naturalWidth,
    containerHeight / naturalHeight,
  );
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height,
  };
}

/** Convert a normalized box to px within the rendered image rect. */
export function toScreenBox(
  box: BoundingBox,
  rect: RenderedImageRect,
): ScreenBox {
  return {
    left: rect.x + box.x * rect.width,
    top: rect.y + box.y * rect.height,
    width: box.width * rect.width,
    height: box.height * rect.height,
  };
}

/**
 * Convert a normalized box to percentages of the rendered image rect —
 * for absolutely-positioned overlays that exactly cover the painted image
 * (immune to later resizes without re-measuring).
 */
export function toPercentBox(box: BoundingBox): {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
} {
  return {
    leftPct: box.x * 100,
    topPct: box.y * 100,
    widthPct: box.width * 100,
    heightPct: box.height * 100,
  };
}
