/**
 * Multi-Product Scanner — product matching layer (Phase 3).
 *
 *   ProductDetection[] → crop each region → existing CLIP embedding →
 *   existing FAISS vector search → ProductMatch[] with top-K candidates.
 *
 * The React UI never touches embeddings, FAISS, or the network directly —
 * everything flows through the `ProductMatcher` interface. Embed/search/crop
 * implementations are injectable so unit tests run with mocks (no ML model).
 *
 * Data-integrity rules enforced here:
 * - DETECTION confidence ("object here?") and IDENTIFICATION (FAISS match)
 *   are never combined into one number.
 * - FAISS L2 distance is a SIMILARITY (lower = closer), not a probability —
 *   exposed raw as `similarity` plus an honest tier (`matchStrength`).
 * - A weak/absent match never invents an identity (`top` may exist while
 *   status stays `weak_match`/`no_match` until the user confirms).
 */
"use client";

import {
  MATCH_CROP_THUMB_MAX_DIM,
  MATCH_POSSIBLE_MAX_DISTANCE,
  MATCH_PRODUCT_TIMEOUT_MS,
  MATCH_STRONG_MAX_DISTANCE,
  MATCH_TOP_K,
} from "./matching-config";
import { cropRectForDetection, type CropRect } from "./crop";
import type { CapturedFrame, ProductDetection } from "./types";
import {
  searchByVector,
  type VisualSearchResponse,
  type VisualSearchResult,
} from "@/lib/visual-search";
import { embedImage } from "@/lib/visual-embed";

/** One FAISS candidate for a detected region. */
export type MatchCandidate = {
  productId: string;
  productName: string;
  image?: string;
  /** Raw FAISS L2 distance — lower means visually closer. NOT a %. */
  similarity: number;
  rank: number;
};

/** Honest identification tier derived from FAISS distance. */
export type MatchStrength = "strong" | "possible" | "none";

export type ProductMatchStatus =
  | "matching"
  | "matched"
  | "weak_match"
  | "no_match"
  | "error";

/** Identification result for a single detection. */
export type ProductMatch = {
  detectionId: string;
  status: ProductMatchStatus;
  candidates: MatchCandidate[];
  /** Rank-1 candidate (may exist even when status is weak_match). */
  top: MatchCandidate | null;
  matchStrength: MatchStrength;
  /** Small JPEG thumbnail of the crop actually searched (UI card). */
  cropImage?: string;
  /** User-confirmed identity — trusted input for Phase 4. */
  confirmedProductId: string | null;
  confirmedProductName: string | null;
  error?: string;
};

export type MatchProgress = {
  completed: number;
  total: number;
  matches: ProductMatch[];
};

export type CropArtifact = {
  blob: Blob;
  /** Small data-URL thumbnail for the UI card. */
  thumb: string;
};

export type MatcherDeps = {
  embed?: (blob: Blob) => Promise<number[]>;
  search?: (vector: number[], topK: number) => Promise<VisualSearchResponse>;
  crop?: (frame: CapturedFrame, rect: CropRect) => Promise<CropArtifact>;
};

export interface ProductMatcher {
  readonly name: string;
  match(
    frame: CapturedFrame,
    detections: ProductDetection[],
    onProgress?: (p: MatchProgress) => void,
  ): Promise<ProductMatch[]>;
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(what)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** Tier a FAISS L2 distance into an honest match strength. */
export function matchStrengthFor(distance: number): MatchStrength {
  if (!Number.isFinite(distance)) return "none";
  if (distance <= MATCH_STRONG_MAX_DISTANCE) return "strong";
  if (distance <= MATCH_POSSIBLE_MAX_DISTANCE) return "possible";
  return "none";
}

function toCandidate(hit: VisualSearchResult, index: number): MatchCandidate | null {
  const name = hit.productName?.trim();
  const similarity = typeof hit.score === "number" ? hit.score : NaN;
  if (!name || !Number.isFinite(similarity)) return null;
  return {
    productId: hit.productId || `visual-${hit.rank ?? index + 1}`,
    productName: name,
    image: hit.sourceImageUrl || undefined,
    similarity,
    rank: hit.rank ?? index + 1,
  };
}

function loadFrameImage(frame: CapturedFrame): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode the captured frame"));
    img.src = frame.dataUrl;
  });
}

/** Default browser crop: region canvas → search blob + small UI thumbnail. */
async function browserCrop(frame: CapturedFrame, rect: CropRect): Promise<CropArtifact> {
  if (typeof document === "undefined") {
    throw new Error("Product matching requires a browser environment");
  }
  const img = await loadFrameImage(frame);
  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not crop the product region");
  ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  );
  if (!blob) throw new Error("Could not encode the product crop");

  // Bounded thumbnail for the result card (canonical source stays the frame).
  const scale = Math.min(
    1,
    MATCH_CROP_THUMB_MAX_DIM / Math.max(rect.width, rect.height),
  );
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = Math.max(1, Math.round(rect.width * scale));
  thumbCanvas.height = Math.max(1, Math.round(rect.height * scale));
  thumbCanvas.getContext("2d")?.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  // Release the full-res crop canvas ASAP; only blob + thumb survive.
  canvas.width = 1;
  canvas.height = 1;
  return { blob, thumb: thumbCanvas.toDataURL("image/jpeg", 0.85) };
}

const pendingMatch = (detectionId: string): ProductMatch => ({
  detectionId,
  status: "matching",
  candidates: [],
  top: null,
  matchStrength: "none",
  confirmedProductId: null,
  confirmedProductName: null,
});

export class VisualSearchMatcher implements ProductMatcher {
  readonly name = "visual-search-matcher";
  private readonly embed: (blob: Blob) => Promise<number[]>;
  private readonly search: (vector: number[], topK: number) => Promise<VisualSearchResponse>;
  private readonly crop: (frame: CapturedFrame, rect: CropRect) => Promise<CropArtifact>;
  private readonly topK: number;

  constructor(deps: MatcherDeps = {}, topK: number = MATCH_TOP_K) {
    this.embed = deps.embed ?? embedImage;
    this.search = deps.search ?? searchByVector;
    this.crop = deps.crop ?? browserCrop;
    this.topK = topK;
  }

  async match(
    frame: CapturedFrame,
    detections: ProductDetection[],
    onProgress?: (p: MatchProgress) => void,
  ): Promise<ProductMatch[]> {
    const total = detections.length;
    const matches: ProductMatch[] = detections.map((d) => pendingMatch(d.id));

    // Sequential, one crop at a time: the embedding model stays warm and the
    // UI receives streaming progress (1/N … N/N) without freezing.
    for (let i = 0; i < detections.length; i++) {
      matches[i] = await this.matchOne(frame, detections[i]);
      onProgress?.({ completed: i + 1, total, matches: [...matches] });
    }
    return matches;
  }

  private async matchOne(
    frame: CapturedFrame,
    detection: ProductDetection,
  ): Promise<ProductMatch> {
    const base = pendingMatch(detection.id);
    try {
      // Each detection searches ONLY its own crop — never the full frame.
      const rect = cropRectForDetection(frame.width, frame.height, detection.boundingBox);
      if (!rect) {
        return { ...base, status: "error", error: "That region is too small to identify." };
      }
      const { blob, thumb } = await withTimeout(
        this.crop(frame, rect),
        MATCH_PRODUCT_TIMEOUT_MS,
        "Cropping the product region timed out",
      );
      const vector = await withTimeout(
        this.embed(blob),
        MATCH_PRODUCT_TIMEOUT_MS,
        "Image embedding timed out",
      );
      const res = await withTimeout(
        this.search(vector, this.topK),
        MATCH_PRODUCT_TIMEOUT_MS,
        "Product search timed out",
      );
      if (!res.ok) {
        return {
          ...base,
          status: "error",
          cropImage: thumb,
          error: res.serviceUnavailable
            ? "Product search is unavailable right now."
            : res.message || "Product search failed.",
        };
      }
      const candidates = (res.results ?? [])
        .map(toCandidate)
        .filter((c): c is MatchCandidate => c !== null)
        .slice(0, this.topK);
      const top = candidates[0] ?? null;
      const strength = top ? matchStrengthFor(top.similarity) : "none";
      return {
        ...base,
        status: strength === "strong" ? "matched" : strength === "possible" ? "weak_match" : "no_match",
        candidates,
        top,
        matchStrength: strength,
        cropImage: thumb,
      };
    } catch (err: unknown) {
      return {
        ...base,
        status: "error",
        error: err instanceof Error ? err.message : "Identification failed unexpectedly.",
      };
    }
  }
}

let sharedMatcher: ProductMatcher | null = null;

/** Scanner default — same instance reused across scans (warm models). */
export function getSharedProductMatcher(): ProductMatcher {
  sharedMatcher ??= new VisualSearchMatcher();
  return sharedMatcher;
}
