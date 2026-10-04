/**
 * Multi-Product Scanner — crop geometry (Phase 3).
 *
 * Pure functions: normalized detection box → clamped source-image pixel
 * rect. Always computed from the ORIGINAL captured frame dimensions, never
 * from UI/displayed coordinates.
 */
import {
  MATCH_CROP_PADDING,
  MATCH_MIN_CROP_PX,
} from "./matching-config";
import type { BoundingBox } from "./types";

/** Pixel rect within the source image. */
export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropRectOptions = {
  padding?: number;
  minSizePx?: number;
};

/**
 * Convert a normalized detection box to a padded, clamped pixel crop rect.
 * Returns null for invalid boxes (non-finite, zero/negative area after
 * clamping) or unusably tiny crops.
 */
export function cropRectForDetection(
  frameWidth: number,
  frameHeight: number,
  box: BoundingBox,
  opts: CropRectOptions = {},
): CropRect | null {
  const padding = opts.padding ?? MATCH_CROP_PADDING;
  const minSize = opts.minSizePx ?? MATCH_MIN_CROP_PX;

  if (
    !Number.isFinite(frameWidth) ||
    !Number.isFinite(frameHeight) ||
    frameWidth <= 0 ||
    frameHeight <= 0 ||
    !box ||
    ![box.x, box.y, box.width, box.height].every((n) => Number.isFinite(n)) ||
    box.width <= 0 ||
    box.height <= 0
  ) {
    return null;
  }

  // Pad by a fraction of the box size, then clamp to the frame.
  const padX = box.width * padding;
  const padY = box.height * padding;
  const x0 = Math.max(0, Math.floor((box.x - padX) * frameWidth));
  const y0 = Math.max(0, Math.floor((box.y - padY) * frameHeight));
  const x1 = Math.min(frameWidth, Math.ceil((box.x + box.width + padX) * frameWidth));
  const y1 = Math.min(frameHeight, Math.ceil((box.y + box.height + padY) * frameHeight));

  const width = x1 - x0;
  const height = y1 - y0;
  if (width < minSize || height < minSize) return null;

  return { x: x0, y: y0, width, height };
}
