/**
 * Multi-Product Scanner — detection layer (Phase 2: real detector).
 *
 * Contract:
 *
 *   camera frame  →  ProductDetector.detect(frame)  →  ProductDetection[]
 *                                                        →  UI overlays
 *
 * The scanner only knows this interface — never the ML library — so the
 * model can be swapped later without touching state or components.
 * `NoopDetector` is kept for tests / offline fallback; the default active
 * detector is the real local ONNX detector (see object-detector.ts).
 */
import type { ProductDetection } from "./types";
import { getSharedProductDetector } from "./object-detector";

export type DetectorFrame = {
  /** Full-frame JPEG data URL. */
  dataUrl: string;
  width: number;
  height: number;
};

export type DetectionProgress = {
  phase: "loading" | "analyzing";
  /** Model-download fraction 0–1 when known. */
  progress?: number;
  onProgress?: (p: { phase: "loading" | "analyzing"; progress?: number }) => void;
};

export interface ProductDetector {
  readonly name: string;
  detect(
    frame: DetectorFrame,
    onProgress?: DetectionProgress["onProgress"],
  ): Promise<ProductDetection[]>;
}

/** Offline/test detector: always returns zero detections. */
export class NoopDetector implements ProductDetector {
  readonly name = "noop-phase1";

  async detect(
    _frame: DetectorFrame,
    _onProgress?: DetectionProgress["onProgress"],
  ): Promise<ProductDetection[]> {
    return [];
  }
}

let activeDetector: ProductDetector | null = null;

/** Swap the detector (tests, future models) without touching the UI. */
export function setProductDetector(detector: ProductDetector): void {
  activeDetector = detector;
}

export function getProductDetector(): ProductDetector {
  // Default: the real local detector. The ONNX model itself only loads
  // inside detect(), so merely resolving the default is cheap and safe.
  activeDetector ??= getSharedProductDetector();
  return activeDetector;
}
