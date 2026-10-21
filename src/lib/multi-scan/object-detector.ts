/**
 * Multi-Product Scanner — real detector (Phase 2).
 *
 * `TransformersProductDetector` implements the `ProductDetector` interface
 * with DETR-ResNet-50 (ONNX) running LOCALY in the browser via the
 * already-installed `@huggingface/transformers` package — the same
 * in-browser ML approach FoodGuard already uses for CLIP embeddings
 * (`lib/visual-embed.ts`). No new dependency, no backend endpoint, no
 * frame ever leaves the device.
 *
 * Model: Xenova/detr-resnet-50 (~160MB fp32, downloaded once from the
 * HuggingFace CDN then browser-cached). COCO 80 classes; only
 * product-plausible classes reach the UI (see detection-config.ts).
 *
 * Lifecycle: pipeline loads lazily on first detect(), the promise is cached
 * and reused (never reloaded per frame — Phase 2 runs one-shot on the
 * captured frame). Deliberately NOT disposed on unmount, matching the CLIP
 * model convention: revisit is instant and there is exactly one instance.
 */
"use client";

import {
  DETECTION_CONFIDENCE_THRESHOLD,
  DETECTION_INFERENCE_TIMEOUT_MS,
  DETECTION_MAX_RESULTS,
  DETECTION_MODEL_ID,
  DETECTION_MODEL_LOAD_TIMEOUT_MS,
  DETECTION_RELEVANT_LABELS,
} from "./detection-config";
import type {
  ProductDetector,
  DetectorFrame,
  DetectionProgress,
} from "./detection";
import { toNormalizedDetections } from "./normalize";

export type TransformersDetectorOptions = {
  modelId?: string;
  threshold?: number;
  maxResults?: number;
};

type ObjectDetectionPipeline = (
  image: unknown,
  opts?: Record<string, unknown>,
) => Promise<unknown>;

// Singleton pipeline promise — initialized once, reused for every frame.
let pipelinePromise: Promise<ObjectDetectionPipeline> | null = null;
let pipelineModelId: string | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(what)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function getPipeline(
  modelId: string,
  onProgress?: DetectionProgress["onProgress"],
): Promise<ObjectDetectionPipeline> {
  if (pipelinePromise && pipelineModelId === modelId) return pipelinePromise;

  pipelinePromise = (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    const pipe = (await withTimeout(
      pipeline("object-detection", modelId, {
        progress_callback: onProgress
          ? (info: unknown) => {
              const rec = info as Record<string, unknown>;
              const progress =
                typeof rec.progress === "number" ? rec.progress / 100 : undefined;
              onProgress({ phase: "loading", progress });
            }
          : undefined,
      }),
      DETECTION_MODEL_LOAD_TIMEOUT_MS,
      `Detection model download timed out (${modelId})`,
    )) as unknown as ObjectDetectionPipeline;
    return pipe;
  })();
  pipelineModelId = modelId;

  // A failed load must not poison the singleton — allow retry.
  pipelinePromise.catch(() => {
    if (pipelineModelId === modelId) {
      pipelinePromise = null;
      pipelineModelId = null;
    }
  });
  return pipelinePromise;
}

export class TransformersProductDetector implements ProductDetector {
  readonly name = "detr-resnet-50-onnx";
  private readonly modelId: string;
  private readonly threshold: number;
  private readonly maxResults: number;

  constructor(opts: TransformersDetectorOptions = {}) {
    this.modelId = opts.modelId ?? DETECTION_MODEL_ID;
    this.threshold = opts.threshold ?? DETECTION_CONFIDENCE_THRESHOLD;
    this.maxResults = opts.maxResults ?? DETECTION_MAX_RESULTS;
  }

  /** True once the model finished loading (first detect is slow, rest instant). */
  isReady(): boolean {
    return pipelinePromise !== null && pipelineModelId === this.modelId;
  }

  async detect(
    frame: DetectorFrame,
    onProgress?: DetectionProgress["onProgress"],
  ): Promise<ReturnType<typeof toNormalizedDetections>> {
    if (typeof window === "undefined") {
      throw new Error("Product detection requires a browser environment");
    }
    onProgress?.({ phase: "loading" });

    const pipe = await getPipeline(this.modelId, onProgress);

    // Data-URL frame → model-ready image (local decode, no upload).
    const { RawImage } = await import("@huggingface/transformers");
    const blob = await (await fetch(frame.dataUrl)).blob();
    const image = await RawImage.fromBlob(blob);

    onProgress?.({ phase: "analyzing" });
    const raw = await withTimeout(
      pipe(image, {
        threshold: this.threshold,
        top_k: this.maxResults * 3,
      }),
      DETECTION_INFERENCE_TIMEOUT_MS,
      "Product detection timed out",
    );

    return toNormalizedDetections(raw, image.width, image.height, {
      threshold: this.threshold,
      maxResults: this.maxResults,
      relevantLabels: DETECTION_RELEVANT_LABELS,
    });
  }
}

// Shared instance used as the scanner's default detector.
let sharedDetector: TransformersProductDetector | null = null;

export function getSharedProductDetector(): TransformersProductDetector {
  sharedDetector ??= new TransformersProductDetector();
  return sharedDetector;
}
