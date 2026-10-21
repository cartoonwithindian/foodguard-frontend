/**
 * Multi-Product Scanner — raw model output → ProductDetection[] (Phase 2).
 *
 * Pure functions (no DOM, no ML imports): the transformers.js
 * object-detection pipeline returns pixel boxes for the source image;
 * these helpers validate, normalize to 0–1 coordinates, filter by
 * allow-list + confidence threshold, sort, and cap the results.
 */
import {
  DETECTION_CONFIDENCE_THRESHOLD,
  DETECTION_MAX_RESULTS,
  DETECTION_RELEVANT_LABELS,
} from "./detection-config";
import { createDetectionId, type ProductDetection } from "./types";

/** One raw hit from the transformers.js object-detection pipeline. */
export type RawModelDetection = {
  label: string;
  score: number;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
};

export type NormalizeOptions = {
  threshold?: number;
  maxResults?: number;
  relevantLabels?: readonly string[];
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Type-guard + sanitize one raw hit; returns null for malformed output. */
function sanitizeRaw(hit: unknown): RawModelDetection | null {
  if (!hit || typeof hit !== "object") return null;
  const { label, score, box } = hit as Record<string, unknown>;
  if (typeof label !== "string" || !isFiniteNumber(score)) return null;
  if (!box || typeof box !== "object") return null;
  const { xmin, ymin, xmax, ymax } = box as Record<string, unknown>;
  if (
    !isFiniteNumber(xmin) ||
    !isFiniteNumber(ymin) ||
    !isFiniteNumber(xmax) ||
    !isFiniteNumber(ymax)
  ) {
    return null;
  }
  if (!(xmax > xmin) || !(ymax > ymin)) return null;
  return { label, score, box: { xmin, ymin, xmax, ymax } };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Normalize raw pipeline hits into canonical ProductDetection[].
 *
 * Canonical coordinates are NORMALIZED (0–1 relative to the source image),
 * never UI pixels — the overlay converts them to screen coordinates.
 * Detections are sorted by confidence (desc) so PRODUCT #1 is always the
 * most confident region.
 */
export function toNormalizedDetections(
  raw: unknown,
  imageWidth: number,
  imageHeight: number,
  opts: NormalizeOptions = {},
): ProductDetection[] {
  const threshold = opts.threshold ?? DETECTION_CONFIDENCE_THRESHOLD;
  const maxResults = opts.maxResults ?? DETECTION_MAX_RESULTS;
  const relevant = opts.relevantLabels ?? DETECTION_RELEVANT_LABELS;

  if (
    !Array.isArray(raw) ||
    !isFiniteNumber(imageWidth) ||
    !isFiniteNumber(imageHeight) ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    return [];
  }

  const allowed = new Set(relevant.map((l) => l.toLowerCase()));

  return raw
    .map(sanitizeRaw)
    .filter((hit): hit is RawModelDetection => hit !== null)
    .filter((hit) => allowed.has(hit.label.toLowerCase()))
    .filter((hit) => hit.score >= threshold)
    .map((hit) => {
      const x = clamp01(hit.box.xmin / imageWidth);
      const y = clamp01(hit.box.ymin / imageHeight);
      // Dimensions from differences (exact float math), clamped to the frame.
      const w = Math.min(clamp01((hit.box.xmax - hit.box.xmin) / imageWidth), 1 - x);
      const h = Math.min(clamp01((hit.box.ymax - hit.box.ymin) / imageHeight), 1 - y);
      return { hit, box: { x, y, width: w, height: h } };
    })
    .filter(({ box }) => box.width > 0 && box.height > 0)
    .sort((a, b) => b.hit.score - a.hit.score)
    .slice(0, Math.max(0, maxResults))
    .map(({ hit, box }) => ({
      id: createDetectionId(),
      boundingBox: box,
      confidence: clamp01(hit.score),
      status: "detected" as const,
      // Raw model class, internal-only (tuning/debug/Phase 3). Never shown
      // to the user as a product name.
      label: hit.label,
    }));
}

/**
 * Re-filter an existing detection list by confidence (e.g. when the user or
 * a later phase tunes the threshold without re-running the model).
 */
export function applyConfidenceFilter(
  detections: ProductDetection[],
  threshold: number = DETECTION_CONFIDENCE_THRESHOLD,
): ProductDetection[] {
  return detections.filter((d) => d.confidence >= threshold);
}
