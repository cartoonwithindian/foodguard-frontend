/**
 * Multi-Product Scanner — pure state machine (no DOM, fully unit-testable).
 *
 * The React hook (`useMultiScanner`) owns side effects (getUserMedia,
 * canvas capture); all transitions live here so they can be tested in Node.
 */
import type {
  CapturedFrame,
  DetectionStatus,
  MultiScannerStatus,
  ProductDetection,
} from "./types";
import type { ProductMatch } from "./matching";
import type { ProductFoodProfile } from "./food-profile";

export type MultiScannerState = {
  status: MultiScannerStatus;
  /** Detections for the current frame (empty until detection succeeds). */
  detections: ProductDetection[];
  /** Identification results keyed by detection id (empty until matched). */
  matches: ProductMatch[];
  /** Structured food profiles for confirmed products. */
  profiles: ProductFoodProfile[];
  /** Last captured frame, kept available for detection + later phases. */
  capturedFrame: CapturedFrame | null;
  /** Human-readable error for the current error state, if any. */
  errorMessage: string | null;
};

export const INITIAL_MULTI_SCANNER_STATE: MultiScannerState = {
  status: "IDLE",
  detections: [],
  matches: [],
  profiles: [],
  capturedFrame: null,
  errorMessage: null,
};

export type MultiScannerEvent =
  | { type: "CAMERA_REQUESTED" }
  | { type: "CAMERA_GRANTED" }
  | { type: "PERMISSION_DENIED" }
  | { type: "CAMERA_UNSUPPORTED" }
  | { type: "CAMERA_FAILED"; message?: string }
  | { type: "FRAME_CAPTURED"; frame: CapturedFrame }
  | { type: "RETAKE" }
  | { type: "CAMERA_STOPPED" }
  | { type: "DETECTIONS_UPDATED"; detections: ProductDetection[] }
  | { type: "DETECTION_STARTED" }
  | { type: "DETECTION_SUCCEEDED"; detections: ProductDetection[] }
  | { type: "DETECTION_FAILED"; message?: string }
  | { type: "MATCHING_STARTED" }
  | { type: "MATCHING_PROGRESS"; matches: ProductMatch[] }
  | { type: "MATCHING_SUCCEEDED"; matches: ProductMatch[] }
  | { type: "MATCHING_FAILED"; message?: string }
  | { type: "PRODUCT_CONFIRMED"; detectionId: string; candidateIndex: number }
  | { type: "ANALYSIS_STARTED" }
  | { type: "ANALYSIS_PROGRESS"; profiles: ProductFoodProfile[] }
  | { type: "ANALYSIS_SUCCEEDED"; profiles: ProductFoodProfile[] }
  | { type: "ANALYSIS_FAILED"; message?: string };

export function multiScannerReducer(
  state: MultiScannerState,
  event: MultiScannerEvent,
): MultiScannerState {
  switch (event.type) {
    case "CAMERA_REQUESTED":
      return {
        ...state,
        status: "CAMERA_REQUESTING_PERMISSION",
        errorMessage: null,
      };
    case "CAMERA_GRANTED":
      // Permission granted + stream live → ready, then immediately scanning.
      return { ...state, status: "SCANNING", errorMessage: null };
    case "PERMISSION_DENIED":
      return { ...state, status: "PERMISSION_DENIED", errorMessage: null };
    case "CAMERA_UNSUPPORTED":
      return { ...state, status: "CAMERA_UNSUPPORTED", errorMessage: null };
    case "CAMERA_FAILED":
      return {
        ...state,
        status: "CAMERA_ERROR",
        errorMessage: event.message ?? null,
      };
    case "FRAME_CAPTURED":
      // Only a live scanning session can produce a capture.
      if (state.status !== "SCANNING" && state.status !== "CAMERA_READY") {
        return state;
      }
      return { ...state, status: "CAPTURED", capturedFrame: event.frame };
    case "RETAKE":
      // Discard the capture, its detections AND its matches; live again.
      if (
        state.status !== "CAPTURED" &&
        state.status !== "PRODUCTS_DETECTED" &&
        state.status !== "NO_PRODUCTS_DETECTED" &&
        state.status !== "DETECTION_ERROR" &&
        state.status !== "DETECTING" &&
        state.status !== "MATCHING" &&
        state.status !== "MATCHES_READY" &&
        state.status !== "MATCHING_ERROR" &&
        state.status !== "ANALYZING" &&
        state.status !== "PROFILES_READY" &&
        state.status !== "ANALYSIS_ERROR"
      ) {
        return state;
      }
      return {
        ...state,
        status: "SCANNING",
        capturedFrame: null,
        detections: [],
        matches: [],
        profiles: [],
        errorMessage: null,
      };
    case "CAMERA_STOPPED":
      return {
        ...INITIAL_MULTI_SCANNER_STATE,
        // Keep the captured frame so Phase 2 can process it after the
        // camera is released; the live session itself is reset.
        capturedFrame: state.capturedFrame,
      };
    case "DETECTIONS_UPDATED":
      // Future live-mode hook: overlay detections without leaving SCANNING.
      if (state.status !== "SCANNING") return state;
      return { ...state, detections: event.detections };
    case "DETECTION_STARTED":
      // (Re-)run detection on the captured frame.
      if (
        state.status !== "CAPTURED" &&
        state.status !== "DETECTION_ERROR" &&
        state.status !== "NO_PRODUCTS_DETECTED"
      ) {
        return state;
      }
      return { ...state, status: "DETECTING", detections: [], errorMessage: null };
    case "DETECTION_SUCCEEDED":
      if (state.status !== "DETECTING") return state;
      return {
        ...state,
        status: event.detections.length > 0 ? "PRODUCTS_DETECTED" : "NO_PRODUCTS_DETECTED",
        detections: event.detections,
      };
    case "DETECTION_FAILED":
      if (state.status !== "DETECTING") return state;
      return {
        ...state,
        status: "DETECTION_ERROR",
        errorMessage: event.message ?? null,
      };
    case "MATCHING_STARTED": {
      // Identify every detection; retryable from match error states.
      if (
        state.status !== "PRODUCTS_DETECTED" &&
        state.status !== "MATCHING_ERROR" &&
        state.status !== "MATCHES_READY"
      ) {
        return state;
      }
      return {
        ...state,
        status: "MATCHING",
        matches: [],
        errorMessage: null,
        detections: state.detections.map((d) => ({ ...d, status: "matching" as const })),
      };
    }
    case "MATCHING_PROGRESS":
    case "MATCHING_SUCCEEDED": {
      if (state.status !== "MATCHING") return state;
      const byId = new Map(event.matches.map((m) => [m.detectionId, m]));
      const detections = state.detections.map((d) => {
        const m = byId.get(d.id);
        return m ? { ...d, status: detectionStatusForMatch(m.status) } : d;
      });
      return {
        ...state,
        status: event.type === "MATCHING_SUCCEEDED" ? "MATCHES_READY" : "MATCHING",
        matches: event.matches,
        detections,
      };
    }
    case "MATCHING_FAILED":
      if (state.status !== "MATCHING") return state;
      return {
        ...state,
        status: "MATCHING_ERROR",
        errorMessage: event.message ?? null,
      };
    case "PRODUCT_CONFIRMED": {
      // Explicit user confirmation only — never automatic. Weak matches may
      // be confirmed deliberately; matches without candidates cannot be.
      // Allowed after analysis too, so more products can be confirmed and
      // analyzed without retaking.
      if (state.status !== "MATCHES_READY" && state.status !== "PROFILES_READY") return state;
      const matches = state.matches.map((m) => {
        if (m.detectionId !== event.detectionId) return m;
        const candidate = m.candidates[event.candidateIndex];
        if (!candidate) return m;
        return {
          ...m,
          confirmedProductId: candidate.productId,
          confirmedProductName: candidate.productName,
        };
      });
      return { ...state, matches };
    }
    case "ANALYSIS_STARTED":
      // Analyze confirmed identities; retryable from analysis error states.
      if (
        state.status !== "MATCHES_READY" &&
        state.status !== "ANALYSIS_ERROR" &&
        state.status !== "PROFILES_READY"
      ) {
        return state;
      }
      return { ...state, status: "ANALYZING", profiles: [], errorMessage: null };
    case "ANALYSIS_PROGRESS":
    case "ANALYSIS_SUCCEEDED": {
      if (state.status !== "ANALYZING") return state;
      return {
        ...state,
        status: event.type === "ANALYSIS_SUCCEEDED" ? "PROFILES_READY" : "ANALYZING",
        profiles: event.profiles,
      };
    }
    case "ANALYSIS_FAILED":
      if (state.status !== "ANALYZING") return state;
      return {
        ...state,
        status: "ANALYSIS_ERROR",
        errorMessage: event.message ?? null,
      };
    default:
      return state;
  }
}

/** Map a per-product match outcome onto the detection lifecycle. */
function detectionStatusForMatch(status: ProductMatch["status"]): DetectionStatus {
  switch (status) {
    case "matching":
      return "matching";
    case "matched":
      return "matched";
    case "weak_match":
      return "weak_match";
    case "no_match":
      return "no_match";
    case "error":
      return "failed";
  }
}

/** Status line shown under the viewport — honest, never fake AI output. */
export function statusMessageFor(status: MultiScannerStatus): string {
  switch (status) {
    case "IDLE":
      return "Ready to scan";
    case "CAMERA_REQUESTING_PERMISSION":
      return "Requesting camera access…";
    case "CAMERA_READY":
    case "SCANNING":
      return "Scanning for products…";
    case "CAPTURED":
      return "Frame captured";
    case "DETECTING":
      return "Analyzing image…";
    case "PRODUCTS_DETECTED":
      return "Products detected";
    case "NO_PRODUCTS_DETECTED":
      return "No products detected";
    case "DETECTION_ERROR":
      return "Product detection failed.";
    case "MATCHING":
      return "Identifying products…";
    case "MATCHES_READY":
      return "Products identified";
    case "MATCHING_ERROR":
      return "Product identification failed.";
    case "ANALYZING":
      return "Analyzing products…";
    case "PROFILES_READY":
      return "Food profiles ready";
    case "ANALYSIS_ERROR":
      return "Product analysis failed.";
    case "PERMISSION_DENIED":
      return "Camera access is required to scan products.";
    case "CAMERA_UNSUPPORTED":
      return "Camera unavailable";
    case "CAMERA_ERROR":
      return "Something went wrong while opening the camera.";
  }
}
