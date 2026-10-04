/**
 * Multi-Product Scanner — Phase 2 data contracts.
 *
 * Phase 2 plugs real detection into `ProductDetection` and `ProductDetector`.
 * Detection identifies REGIONS ("this looks like a product package") — it
 * never names products; productId/productName/nutrition stay reserved for
 * later phases and must not be populated here.
 */

/** Finite scanner states (Phase 1 + Phase 2 detection + Phase 3 matching). */
export type MultiScannerStatus =
  | "IDLE"
  | "CAMERA_REQUESTING_PERMISSION"
  | "CAMERA_READY"
  | "SCANNING"
  | "CAPTURED"
  | "DETECTING"
  | "PRODUCTS_DETECTED"
  | "NO_PRODUCTS_DETECTED"
  | "DETECTION_ERROR"
  | "MATCHING"
  | "MATCHES_READY"
  | "MATCHING_ERROR"
  | "ANALYZING"
  | "PROFILES_READY"
  | "ANALYSIS_ERROR"
  | "PERMISSION_DENIED"
  | "CAMERA_ERROR"
  | "CAMERA_UNSUPPORTED";
// Later phases extend this union instead of rewriting it:
// | "ANALYZING"

/** Normalized bounding box (0–1 relative to the frame). */
export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Lifecycle of a single detected product region. */
export type DetectionStatus =
  | "detected"
  | "matching"
  | "matched"
  | "weak_match"
  | "no_match"
  | "failed";

/**
 * A single product region found in a camera frame.
 *
 * Phase 1 only requires: id, boundingBox, confidence, status.
 * The remaining fields are reserved for Phase 2+ (detection → matching →
 * nutrition → personal fit) and must stay optional until real data exists.
 * Do NOT populate productName / nutrition with placeholder values.
 */
export type ProductDetection = {
  id: string;
  boundingBox: BoundingBox;
  confidence: number;
  status: DetectionStatus;
  /**
   * Raw model class (e.g. "bottle", "book"). Internal-only: used for
   * allow-list filtering, debugging, and tuning. NEVER shown to the user
   * as a product name — the UI displays generic "PRODUCT N".
   */
  label?: string;
  /** Phase 2+: cropped region image (data URL) for matching. */
  imageCrop?: string;
  /** Phase 2+: resolved catalog product id. */
  productId?: string;
  /** Phase 2+: resolved display name (real lookup only — never fake). */
  productName?: string;
  /** Phase 2+: extracted nutrition facts. */
  nutrition?: Record<string, number | string>;
  /** Phase 2+: personalized fit score / label. */
  personalFit?: string;
};

/** A captured camera frame awaiting Phase 2 processing. */
export type CapturedFrame = {
  /** JPEG data URL of the full frame. */
  dataUrl: string;
  width: number;
  height: number;
  capturedAt: number;
};

export function createDetectionId(): string {
  return `det_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
