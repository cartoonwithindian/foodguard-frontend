/**
 * Multi-Product Scanner — detection configuration (Phase 2).
 *
 * Single place to tune the real detector. Nothing in the UI imports model
 * specifics; the detector reads these values.
 */

/** ONNX object-detection model, loaded in-browser via @huggingface/transformers. */
export const DETECTION_MODEL_ID = "Xenova/detr-resnet-50";

/**
 * Minimum model confidence (0–1) for a region to be shown as a product.
 * This is DETECTION confidence ("the model is X% sure this region is an
 * object") — never a health score. Tune freely; the UI never hardcodes it.
 */
export const DETECTION_CONFIDENCE_THRESHOLD = 0.5;

/** Maximum boxes rendered per frame (prevents overlay clutter). */
export const DETECTION_MAX_RESULTS = 10;

/** First-load budget incl. model download; slower networks hit this. */
export const DETECTION_MODEL_LOAD_TIMEOUT_MS = 120_000;

/** Per-frame inference budget once the model is cached. */
export const DETECTION_INFERENCE_TIMEOUT_MS = 60_000;

/**
 * COCO classes treated as "this region appears to contain a food/product
 * package". DETR only knows the 80 COCO classes, so packaged goods surface
 * under these labels:
 *
 * - Drink containers & tableware: bottle, wine glass, cup, fork, knife,
 *   spoon, bowl
 * - Food: banana, apple, sandwich, orange, broccoli, carrot, hot dog,
 *   pizza, donut, cake
 * - "book": rigid rectangular packages (cereal boxes, cartons) frequently
 *   classify as book — included deliberately, documented here.
 *
 * Everything else (person, chair, tv, …) is excluded so background clutter
 * never becomes a fake "product". The raw model label is kept on each
 * detection (`label`) for debugging/tuning; the UI shows generic
 * "PRODUCT N" + confidence only.
 */
export const DETECTION_RELEVANT_LABELS: readonly string[] = [
  "bottle",
  "wine glass",
  "cup",
  "fork",
  "knife",
  "spoon",
  "bowl",
  "banana",
  "apple",
  "sandwich",
  "orange",
  "broccoli",
  "carrot",
  "hot dog",
  "pizza",
  "donut",
  "cake",
  "book",
];

/**
 * Generic display category for every Phase 2 detection. Phase 2 detects
 * REGIONS, it does not identify products — so no COCO label is ever shown
 * to the user as a product name.
 */
export const DETECTION_DISPLAY_CATEGORY = "product" as const;
