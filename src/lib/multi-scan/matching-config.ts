/**
 * Multi-Product Scanner — matching configuration (Phase 3).
 *
 * Single place to tune identification. Thresholds are grounded in real
 * FoodGuard FAISS data (IndexFlatL2 on raw 512-d CLIP embeddings):
 * same-family top hits cluster at L2 ≈ 20–22
 * (see search/foodguard_search_result.json — Kellogg's query).
 *
 * L2 distance is a SIMILARITY (lower = closer), not a calibrated
 * probability — the UI must display match strength honestly, never as %.
 */

/** Candidates retrieved per detected product. */
export const MATCH_TOP_K = 3;

/**
 * Top-hit distance at or below this → STRONG match.
 * Conservative: inside the observed same-family cluster (20–22).
 */
export const MATCH_STRONG_MAX_DISTANCE = 23;

/**
 * Top-hit distance at or below this (but above strong) → POSSIBLE match:
 * shown with candidates for the user to confirm. Above this → NO reliable
 * match; never invent an identity.
 */
export const MATCH_POSSIBLE_MAX_DISTANCE = 32;

/** Padding around a detection box (fraction of box size) for the crop. */
export const MATCH_CROP_PADDING = 0.08;

/** Crops smaller than this (px, either side) are rejected as unusable. */
export const MATCH_MIN_CROP_PX = 24;

/** Max dimension (px) of the crop thumbnail kept for the UI card. */
export const MATCH_CROP_THUMB_MAX_DIM = 256;

/** Per-product budget for crop → embed → FAISS search. */
export const MATCH_PRODUCT_TIMEOUT_MS = 60_000;
