/**
 * Unified product-resolution service — local-first.
 *
 * Every input method (barcode scan, manual barcode, product-name search, and
 * product photo / OCR) funnels through `resolveProduct*` helpers. Resolution
 * prefers local sources in this order:
 *
 *   1. on-device IndexedDB cache       (instant, offline-friendly, SWR)
 *   2. bundled offline database        (tiny curated subset, `local_database`)
 *   3. FoodGuard server API            (`/api/products/barcode|/search|/scan/label`)
 *
 * Network calls are wrapped with a timeout, transient retries and in-flight
 * dedup (request-manager). Every resolved product records how it was found in
 * `resolutionSource` (`local_cache` / `local_database` / `network` / `fallback`).
 * Cache provenance never lowers `product.confidence`.
 */
import type {
  ExtractedInfo,
  IdentifiedProduct,
  ProductResolution,
  ProductSource,
} from "@/types/identification";
import { normalizeBarcode } from "@/types/identification";
import { getProductCache, isStaleRecord } from "@/lib/cache/product-cache";
import type { ProductCacheRecord } from "@/lib/cache/product-cache";
import { getStorage } from "@/lib/offline/storage";
import { lookupOfflineByBarcode, searchOfflineByName } from "@/lib/offline/local-database";
import { httpJson } from "@/lib/network/request-manager";
import { apiUrl } from "@/lib/network/api-url";
import { isOnline, NETWORK_TIMEOUTS } from "@/lib/network/network-status";
import { getFoodGuardAuthHeaders } from "@/services/gamification.service";
import { canCompressClientSide, compressImageForUpload } from "@/lib/image/compress";
import { logger } from "@/lib/logger";

/** A visually-similar product returned by the visual search service. */
type VisualSearchHit = {
  rank?: number;
  productName?: string;
  productId?: string | null;
  score?: number;
  imagePath?: string | null;
};

/** Optional public base URL for the visual-search product images. */
const VISUAL_IMAGES_URL = (
  process.env.NEXT_PUBLIC_VISUAL_IMAGES_URL || ""
).replace(/\/+$/, "");

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)));
}

function visualImageUrl(hit: VisualSearchHit): string | undefined {
  const imagePath = hit.imagePath;
  if (!imagePath || !VISUAL_IMAGES_URL) return undefined;
  const clean = decodeHtmlEntities(imagePath.replace(/^\/+/, ""));
  return `${VISUAL_IMAGES_URL}/${clean.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Convert visual-search hits into IdentifiedProduct candidates so the photo
 * scan can offer them in the same "candidates" picker used by name search.
 * The FAISS score is an L2 distance (lower = closer), so confidence here is a
 * rough heuristic, not a probability.
 */
function visualHitsToCandidates(hits: VisualSearchHit[] | null | undefined): IdentifiedProduct[] {
  if (!hits || hits.length === 0) return [];
  return hits.map((hit, index) => {
    const name = hit.productName?.trim() || "Unknown Product";
    const distance = typeof hit.score === "number" ? hit.score : 0;
    // L2 distance, not a probability: clamp the presentational confidence so
    // an exact hit never renders as "100%".
    const confidence = Math.max(0.05, Math.min(0.95, distance + 2 > 0 ? 1 / (1 + distance) : 0.05));
    return {
      id: hit.productId || `visual-${index + 1}`,
      barcode: "",
      name,
      brand: "",
      category: "",
      imageUrl: visualImageUrl(hit),
      source: "photo_ocr",
      sourceDetail: "visual_search",
      confidence,
      resolutionSource: "network",
    } satisfies IdentifiedProduct;
  });
}

export type BarcodeLookupResponse = {
  success: boolean;
  data?: {
    product: {
      id: string;
      barcode: string;
      name: string;
      brand: string | null;
      category: string;
      country?: string | null;
      servingSize?: string | null;
      imageUrl?: string | null;
      ingredientsRaw?: string;
      verified?: boolean;
      isDemo?: boolean;
      productDataConfidence?: number;
    };
    nutrition?: Record<string, unknown> | null;
    source?: string;
    confidence?: number;
    mergedFrom?: string[];
    cached?: boolean;
  };
  error?: { message?: string } | null;
};

export type NameSearchResponse = {
  success: boolean;
  data?: {
    products: Array<{
      id: string;
      name: string;
      brand: string;
      category: string;
      barcode: string;
      score: number;
      ingredients?: string;
      isDemo?: boolean;
      verified?: boolean;
    }>;
    total: number;
  };
  error?: { message?: string } | null;
};

export type ScanLabelResponse = {
  success: boolean;
  barcode?: {
    value: string | null;
    format: string | null;
    status: "success" | "not_found" | "failed";
  };
  ocr?: {
    text: string;
    status: "success" | "failed";
    confidence: number | null;
    needsReview: boolean;
    provider: string;
  };
  ingredients?: string[];
  ingredientsText?: string;
  nutrition?: Record<string, unknown> | null;
  product?: {
    id: string;
    name: string;
    brand: string | null;
    category: string;
    barcode: string;
    source: string;
    confidence: number;
  };
  sources?: string[];
  /**
   * Top-K visually similar products returned by the hosted CLIP+FAISS service.
   * The backend already populates this (and lists "visual_search" in `sources`),
   * but the client used to drop it on the floor, so an image upload with no
   * readable barcode or OCR text degraded to `not_found`.
   */
  similarProducts?: Array<{
    rank?: number;
    productName?: string;
    productId?: string | null;
    score?: number;
    imagePath?: string | null;
  }> | null;
  rawText?: string;
  productName?: string | null;
  /** Short-lived same-origin URL of the uploaded photo. */
  imageUrl?: string | null;
  error?: string;
};

/** One CLIP+FAISS similarity hit, as returned by both visual-search paths. */
type VisualMatch = {
  rank: number;
  productName: string;
  productId: string;
  score: number;
  imagePath?: string | null;
};

/** Map one visual-search hit into a candidate {@link IdentifiedProduct}. */
function productFromVisualMatch(match: VisualMatch): IdentifiedProduct {
  return {
    id: match.productId,
    barcode: "",
    name: match.productName,
    brand: "",
    category: "food",
    source: "photo_ocr",
    sourceDetail: "visual_search",
    // L2 distance, not a 0..1 probability. Map the useful band into a
    // presentational confidence so the UI does not render "100%".
    confidence: Math.max(0.05, Math.min(0.95, 1 - match.score / 100)),
  };
}

/** All visual matches as candidates, best match first. */
function visualCandidates(matches: VisualMatch[] | null | undefined): IdentifiedProduct[] {
  if (!Array.isArray(matches) || matches.length === 0) return [];
  return matches
    .filter((m) => m && typeof m.productName === "string" && m.productName.trim())
    .map(productFromVisualMatch);
}

function friendlyError(op: string): string {
  return `We couldn't ${op} right now. Please check your connection and try again.`;
}

/** Only durable (IndexedDB / test-injected) storage powers the local cache. */
function cacheUsable(): boolean {
  return getStorage().supported();
}

function barcodeDedupeKey(barcode: string): string {
  return `barcode:${barcode}`;
}

/** Map a barcode-lookup response product into an {@link IdentifiedProduct}. */
function productFromBarcodeJson(
  json: BarcodeLookupResponse,
  source: ProductSource,
  resolutionSource: "network",
): IdentifiedProduct | null {
  const p = json.data?.product;
  if (!p) return null;
  const confidence = typeof json.data?.confidence === "number" ? json.data.confidence : 0.5;
  return {
    id: p.id ?? "",
    barcode: p.barcode,
    name: p.name || `Product ${p.barcode}`,
    brand: p.brand ?? "",
    category: p.category || "food",
    imageUrl: p.imageUrl ?? null,
    ingredientsRaw: p.ingredientsRaw ?? "",
    nutrition: json.data?.nutrition ?? null,
    source,
    sourceDetail: json.data?.source,
    confidence: Math.max(0, Math.min(1, confidence)),
    isDemo: p.isDemo,
    verified: p.verified,
    resolutionSource,
  };
}

/** Apply a cached product to a resolution (never lowering its confidence). */
function productFromCache(record: ProductCacheRecord, source: ProductSource): IdentifiedProduct {
  return {
    ...record.product,
    source,
    resolutionSource: "local_cache",
    cachedAt: record.updatedAt,
  };
}

/**
 * Background stale-while-revalidate refresh for a barcode. Fires a network
 * lookup without awaiting; failures are swallowed so the cached view is
 * never replaced by an error.
 */
async function refreshBarcode(barcode: string, source: ProductSource): Promise<void> {
  const clean = normalizeBarcode(barcode);
  if (!clean) return;
  try {
    const response = await httpJson(apiUrl(`/api/products/barcode/${encodeURIComponent(clean)}`), {
      timeoutMs: NETWORK_TIMEOUTS.lookup,
      dedupeKey: barcodeDedupeKey(clean),
    });
    const json = (await response.json().catch(() => null)) as BarcodeLookupResponse | null;
    if (!response.ok || !json?.success || !json.data?.product) return;
    const product = productFromBarcodeJson(json, source, "network");
    if (product) await getProductCache().save(product, "network");
  } catch (error) {
    logger.debug("swr_refresh_failed", { barcode: clean, error: String(error) });
  }
}

/**
 * Resolve a product by barcode (camera scan or manual entry both work).
 *
 * Order: on-device cache (instant) → bundled offline database (when offline)
 * → FoodGuard API (with timeout + transient retry + dedup). Cached results
 * are returned immediately; stale results trigger a background refresh.
 */
export async function resolveProductByBarcode(
  barcode: string,
  source: ProductSource,
): Promise<ProductResolution> {
  const clean = normalizeBarcode(barcode);
  if (!clean) {
    return { status: "error", message: "Please enter a barcode number." };
  }

  const cache = cacheUsable() ? getProductCache() : null;

  // 1. On-device cache — instant, works fully offline.
  if (cache) {
    const record = await cache.getByBarcode(clean);
    if (record) {
      const product = productFromCache(record, source);
      if (isStaleRecord(record)) {
        // Serve stale immediately, refresh in the background (SWR).
        void refreshBarcode(clean, source);
      }
      return { status: "resolved", product, extracted: { barcode: clean } };
    }
  }

  const online = isOnline();

  // 2. Offline → bundled offline database.
  if (!online) {
    const offline = lookupOfflineByBarcode(clean);
    if (offline) {
      return { status: "resolved", product: offline, extracted: { barcode: clean } };
    }
    return { status: "error", message: friendlyError("search for that barcode") };
  }

  // 3. Network (FoodGuard API), with timeout + transient retry + dedup.
  try {
    const response = await httpJson(apiUrl(`/api/products/barcode/${encodeURIComponent(clean)}`), {
      timeoutMs: NETWORK_TIMEOUTS.lookup,
      dedupeKey: barcodeDedupeKey(clean),
    });
    const json = (await response.json().catch(() => null)) as BarcodeLookupResponse | null;

    if (!response.ok || !json?.success || !json.data?.product) {
      return {
        status: "not_found",
        barcode: clean,
        extracted: { barcode: clean },
      };
    }

    const product = productFromBarcodeJson(json, source, "network");
    if (!product) {
      return {
        status: "not_found",
        barcode: clean,
        extracted: { barcode: clean },
      };
    }
    if (cache) {
      void cache.save(product, "network");
    }
    return { status: "resolved", product, extracted: { barcode: clean } };
  } catch {
    // 4. Network failed after retries → last-resort offline database.
    const offline = lookupOfflineByBarcode(clean);
    if (offline) {
      return { status: "resolved", product: offline, extracted: { barcode: clean } };
    }
    return { status: "error", message: friendlyError("search for that barcode") };
  }
}

/**
 * Search FoodGuard's database by product name / brand / partial name.
 *
 * When offline the bundled offline database + on-device cache back the query;
 * when online the server search runs and its hits are cached for later
 * offline use.
 */
export async function searchProductCandidates(query: string): Promise<ProductResolution> {
  const q = query.trim();
  if (!q) {
    return { status: "error", message: "Type a product name or brand to search." };
  }

  const online = isOnline();
  const cache = cacheUsable() ? getProductCache() : null;

  // Offline / degraded: search locally (cache + offline database).
  if (!online) {
    const cached = (cache ? await cache.searchCached(q, 12) : []).map((record) =>
      productFromCache(record, "name_search"),
    );
    const local = searchOfflineByName(q, 12);
    const candidates = mergeCandidates([...cached, ...local]);
    return fromCandidates(candidates, { query: q });
  }

  try {
    const response = await httpJson(apiUrl(`/api/products/search?q=${encodeURIComponent(q)}`), {
      timeoutMs: NETWORK_TIMEOUTS.lookup,
      dedupeKey: `search:${q}`,
    });
    const json = (await response.json().catch(() => null)) as NameSearchResponse | null;

    if (!response.ok || !json?.success || !json.data) {
      return { status: "error", message: friendlyError("search products") };
    }

    const candidates: IdentifiedProduct[] = (json.data.products ?? []).map((p) => ({
      id: p.id,
      barcode: p.barcode,
      name: p.name,
      brand: p.brand ?? "",
      category: p.category || "food",
      ingredientsRaw: p.ingredients ?? "",
      source: "name_search",
      sourceDetail: `search:${q}`,
      confidence: typeof p.score === "number" ? Math.max(0, Math.min(1, p.score / 100)) : 0.5,
      isDemo: p.isDemo,
      verified: p.verified,
      resolutionSource: "network",
    }));

    // Cache network hits for later offline use.
    if (cache) {
      for (const product of candidates) {
        if (product.barcode) void cache.save(product, "network");
      }
    }
    return fromCandidates(candidates, { query: q });
  } catch {
    // Network failed → surface local matches if any, otherwise a friendly error.
    const cached = (cache ? await cache.searchCached(q, 12) : []).map((record) =>
      productFromCache(record, "name_search"),
    );
    const local = searchOfflineByName(q, 12);
    const candidates = mergeCandidates([...cached, ...local]);
    if (candidates.length > 0) return fromCandidates(candidates, { query: q });
    return { status: "error", message: friendlyError("search products") };
  }
}

/** De-duplicate + order candidates by confidence, capping the list. */
function mergeCandidates(input: IdentifiedProduct[]): IdentifiedProduct[] {
  const byBarcode = new Map<string, IdentifiedProduct>();
  for (const candidate of input) {
    const key = candidate.barcode || candidate.name.toLowerCase();
    const existing = byBarcode.get(key);
    if (existing && existing.resolutionSource === "network" && !existing.id.startsWith("offline-")) {
      continue; // prefer network-resolved data
    }
    byBarcode.set(key, candidate);
  }
  return [...byBarcode.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 15);
}

function fromCandidates(
  candidates: IdentifiedProduct[],
  extra: { query?: string; extracted?: ExtractedInfo },
): ProductResolution {
  if (candidates.length === 0) {
    return { status: "not_found", query: extra.query, extracted: extra.extracted };
  }
  if (candidates.length === 1) {
    return {
      status: "resolved",
      product: candidates[0],
      extracted: extra.extracted ?? { productName: extra.query },
    };
  }
  return { status: "candidates", candidates, query: extra.query, extracted: extra.extracted };
}

/**
 * Identify a product from a photo/package image through the server pipeline.
 *
 * The image is compressed on-device before upload (adaptive target by network
 * quality) — never uploading a raw multi-MB frame on a slow connection.
 */
/**
 * Resolve a product from a direct image URL.
 *
 * Hits `POST /api/visual-search-url`, which validates the URL (http(s) only,
 * public hosts, no credentials) and asks the hosted CLIP+FAISS service for the
 * nearest product images. Returns the matches as candidates -- the user picks
 * one, because a visual match is a guess, not an identification.
 */
export async function resolveProductByImageUrl(
  imageUrl: string,
  topK = 8,
): Promise<ProductResolution> {
  const trimmed = imageUrl.trim();
  if (!/^https?:\/\/[^\s]+$/i.test(trimmed)) {
    return {
      status: "error",
      message: "Please enter a full http(s) image link.",
    };
  }

  try {
    const response = await httpJson(apiUrl("/api/visual-search-url"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getFoodGuardAuthHeaders(),
      },
      body: JSON.stringify({ image_url: trimmed, top_k: topK }),
      timeoutMs: NETWORK_TIMEOUTS.upload,
    });
    const json = (await response.json().catch(() => null)) as {
      success?: boolean;
      data?: { results?: VisualMatch[] } | null;
      error?: { message?: string } | null;
    } | null;

    if (!response.ok || !json?.success) {
      const message =
        json?.error?.message ??
        "We couldn't search that image link right now. Please try again.";
      return { status: "error", message };
    }

    const candidates = visualCandidates(json.data?.results);
    if (candidates.length === 0) {
      return { status: "not_found", query: trimmed };
    }
    const extracted: ExtractedInfo = { imageUrl: trimmed };
    if (candidates.length === 1) {
      return { status: "resolved", product: candidates[0], extracted };
    }
    return { status: "candidates", candidates, query: trimmed, extracted };
  } catch {
    return {
      status: "error",
      message: "We couldn't search that image link right now. Please check your connection.",
    };
  }
}

export async function resolveProductByPhoto(
  file: Blob | File,
): Promise<{ resolution: ProductResolution; extracted: ExtractedInfo }> {
  const extracted: ExtractedInfo = {};

  try {
    // Adaptively compress before upload; pass through when not possible.
    let upload: Blob = file;
    if (canCompressClientSide() && isOnline()) {
      try {
        upload = await compressImageForUpload(file);
      } catch {
        upload = file;
      }
    }

    const form = new FormData();
    const blob = upload instanceof Blob ? upload : new Blob([upload], { type: "image/jpeg" });
    const ext = blob.type.includes("png")
      ? "png"
      : blob.type.includes("webp")
        ? "webp"
        : blob.type.includes("heic") || blob.type.includes("heif")
          ? "heic"
          : "jpg";
    form.append("image", blob, `label.${ext}`);
    form.append("detectBarcode", "true");

    // Best-effort client-side CLIP embedding so the backend can return
    // visually-similar products via FAISS only. This must never hold up the
    // upload: the first scan would otherwise wait for the ~90 MB vision model
    // to download from the Hub, which looked like a stuck upload. Give a warm
    // model a moment, then send the image and let the backend embed it.
    try {
      const { config } = await import("@/lib/config");
      if (config.visualSearch.clientEmbed && typeof window !== "undefined") {
        const { embedImage } = await import("@/lib/visual-embed");
        const embedding = await Promise.race([
          embedImage(blob).catch(() => null),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
        ]);
        if (embedding) form.append("embedding", JSON.stringify(embedding));
      }
    } catch {
      // ignore — visual search candidates are optional
    }

    const response = await httpJson(apiUrl("/api/scan/label"), {
      method: "POST",
      body: form,
      timeoutMs: NETWORK_TIMEOUTS.upload,
    });
    const json = (await response.json().catch(() => null)) as (ScanLabelResponse & {
      rawText?: string;
      ingredientsText?: string;
      productName?: string;
      imageUrl?: string | null;
      error?: { message?: string } | string | null;
      /** The backend's jsonSuccess() envelope. */
      data?: ScanLabelResponse;
    }) | null;

    if (!response.ok || !json?.success) {
      const raw: unknown = json?.error;
      const message =
        (typeof raw === "string" ? raw : (raw && typeof raw === "object" && "message" in raw ? String((raw as { message?: unknown }).message ?? "") : "")) ||
        "We couldn't read this photo. Try a clearer, well-lit image of the packaging.";
      return { resolution: { status: "error", message, extracted }, extracted };
    }

    // `/api/scan/label` responds through jsonSuccess(), so the scan payload is
    // nested under `data`. Reading the top level made every upload look like
    // "we couldn't read this photo" even when OCR had succeeded.
    const payload: ScanLabelResponse = json.data ?? json;

    // Fill extracted info
    const barcodeValue = payload.barcode?.value ?? null;
    const ocrText = payload.ocr?.text ?? payload.rawText ?? "";
    extracted.barcode = barcodeValue ?? undefined;
    extracted.ocrText = ocrText || undefined;
    extracted.ingredientsText = payload.ingredientsText ?? undefined;
    extracted.nutrition = payload.nutrition ?? null;
    extracted.ocrConfidence = payload.ocr?.confidence ?? undefined;
    extracted.needsReview = payload.ocr?.needsReview ?? false;
    // The backend hosts the uploaded photo at a short-lived same-origin URL
    // (10-minute TTL) so the analysis page can show the user the exact image
    // they scanned.
    extracted.imageUrl = payload.imageUrl ?? extracted.imageUrl ?? undefined;

    const nameGuess = guessProductName(ocrText, payload.product?.name);
    extracted.productName = nameGuess || undefined;

    // 1. Barcode detected on the photo -> resolve straight through barcode.
    let barcodeResolution: ProductResolution | null = null;
    if (barcodeValue) {
      barcodeResolution = await resolveProductByBarcode(barcodeValue, "photo_ocr");
      if (barcodeResolution.status === "resolved") {
        return { resolution: { ...barcodeResolution, extracted }, extracted };
      }
      // Unmatched barcode -> fall through so visual-similar candidates (say,
      // barcode present but unknown product) can still rescue the scan.
    }

    // Visually similar products from the hosted CLIP+FAISS service. These are a
    // *fallback* for when text matching cannot identify the product -- they are
    // never preferred over a real barcode or name match.
    const similar = visualHitsToCandidates(payload.similarProducts);
    const similarResolution = (): ProductResolution => {
      const [best] = similar;
      if (similar.length === 1) {
        return { status: "resolved", product: best, extracted };
      }
      return { status: "candidates", candidates: similar, extracted };
    };

    // 2. No barcode but OCR gave a name -> run name matching.
    if (nameGuess) {
      const resolution = await searchProductCandidates(nameGuess);
      if (resolution.status === "candidates" || resolution.status === "resolved") {
        return { resolution: { ...resolution, extracted }, extracted };
      }
      // Name matching found nothing, but the image may still look like a known
      // product -- offer the visual matches instead of dead-ending.
      if (similar.length > 0) {
        return { resolution: similarResolution(), extracted };
      }
    }

    // 3. No barcode and no usable name. Visual similarity is the last chance to
    //    identify the product before giving up.
    if (similar.length > 0) {
      return { resolution: similarResolution(), extracted };
    }

    // 4. Nothing usable detected. If a barcode was present, report its
    //    (failed) lookup result so the UI can show the "not found" screen.
    if (barcodeResolution) {
      return { resolution: { ...barcodeResolution, extracted }, extracted };
    }
    return {
      resolution: {
        status: "not_found",
        query: nameGuess ?? undefined,
        extracted,
      },
      extracted,
    };
  } catch {
    return {
      resolution: { status: "error", message: friendlyError("read this photo") },
      extracted,
    };
  }
}

/**
 * Local-first photo resolution: try the on-device barcode decoder first
 * (works offline and online), then fall back to pure-client OCR when offline
 * or on slow connections, and only then to the server OCR pipeline.
 */
export async function resolveProductByPhotoLocalFirst(
  file: Blob | File,
  onProgress?: (status: string) => void,
): Promise<{ resolution: ProductResolution; extracted: ExtractedInfo }> {
  const extracted: ExtractedInfo = {};

  // 1. Local barcode decode — fast and offline-friendly.
  if (typeof window !== "undefined") {
    try {
      const { decodeBarcodeFromImage } = await import("@/lib/barcode/decoder");
      const barcode = await decodeBarcodeFromImage(file);
      if (barcode?.value) {
        extracted.barcode = barcode.value;
        const resolution = await resolveProductByBarcode(barcode.value, "photo_ocr");
        return { resolution, extracted };
      }
    } catch {
      // fall through to OCR / server
    }
  }

  const online = isOnline();

  // 2. Offline / slow → pure-client OCR.
  if (!online) {
    onProgress?.("Running offline OCR");
    const { recognizeLocal } = await import("@/lib/offline/local-ocr");
    const ocr = await recognizeLocal(file, (status) => onProgress?.(status));
    if (ocr?.text) {
      extracted.ocrText = ocr.text;
      extracted.ocrConfidence = ocr.confidence;
      extracted.needsReview = ocr.confidence < 0.6;
      const nameGuess = guessProductName(ocr.text);
      if (nameGuess) {
        extracted.productName = nameGuess;
        const resolution = await searchProductCandidates(nameGuess);
        if (resolution.status === "candidates" || resolution.status === "resolved") {
          return { resolution: { ...resolution, extracted }, extracted };
        }
        return { resolution: { status: "not_found", query: nameGuess, extracted }, extracted };
      }
    }
    return { resolution: { status: "not_found", extracted }, extracted };
  }

  // 3. Online → server pipeline (compressed upload).
  return resolveProductByPhoto(file);
}

/**
 * Best-effort product name extraction from raw OCR text.
 * Prefers the first short non-empty line that carries a retail name look.
 */
export function guessProductName(ocrText: string, known?: string | null): string | null {
  if (known && known.trim()) return known.trim().slice(0, 200);
  if (!ocrText) return null;

  const lines = ocrText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const stop = new Set([
    "ingredients",
    "ingredient",
    "nutrition",
    "nutritional",
    "value",
    "values",
    "manufactured",
    "marketed",
    "fssai",
    "lic",
    "contains",
    "may contain",
    "net weight",
    "best before",
    "storage",
    "serve",
    "serving",
    "per 100g",
    "per serving",
    "energy",
    "protein",
    "carbohydrates",
    "fat",
    "salt",
    "sugar",
    "imported",
    "imported by",
    "distributed",
  ]);

  // Measurement/label furniture that often sits right under the brand and
  // would otherwise be picked as the product name ("Net Weight 70g").
  const furniture =
    /^(net\s*(weight|wt|quantity|qty)|per\s+(100|serving)|energy|protein|carbohydrate|fat|sugar|salt|nutrition|best\s+before|mfg|exp|fssai)/i;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (stop.has(lower)) continue;
    if (furniture.test(line)) continue;
    if (lower.includes("www.") || lower.includes(".com") || lower.includes(".in")) continue;
    if (line.length < 2 || line.length > 60) continue;
    if (/^[\d\s.,%]+$/.test(line)) continue;
    // Require at least two letters: skips barcodes, dates and percentages but
    // keeps real names that legitimately start with a digit ("2-Minute...").
    if ((line.match(/[A-Za-z]/g) ?? []).length < 2) continue;
    return line;
  }
  return null;
}

/**
 * Build the /analysis route path that feeds the SAME Product Analysis
 * pipeline used by barcode scanning.
 */
export function buildAnalysisPath(
  product: IdentifiedProduct,
  extracted?: ExtractedInfo,
  imageUrl?: string | null,
  scanEventId?: string,
): string {
  const params = new URLSearchParams();
  if (product.barcode) params.set("barcode", product.barcode);
  else if (extracted?.barcode) params.set("barcode", extracted.barcode);
  if (product.name && product.name !== `Product ${product.barcode}`) {
    params.set("productName", product.name);
  }
  if (product.brand) params.set("brand", product.brand);
  if (product.ingredientsRaw) params.set("ingredients", product.ingredientsRaw);
  if (extracted?.ocrText) params.set("ocrText", extracted.ocrText);
  if (typeof extracted?.ocrConfidence === "number") {
    params.set("ocrConfidence", String(extracted.ocrConfidence));
  }
  const img = imageUrl || product.imageUrl || extracted?.imageUrl;
  if (img) params.set("imageUrl", img);
  if (scanEventId) params.set("scan_event_id", scanEventId);
  const qs = params.toString();
  return qs ? `/analysis?${qs}` : "/analysis";
}