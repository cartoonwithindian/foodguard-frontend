/**
 * Multi-Product Scanner — camera + capture + detection orchestration.
 *
 * Owns all side effects: getUserMedia lifecycle, canvas capture, upload
 * fallback, and Phase 2 detection runs. Pure transitions live in
 * `state.ts`. The stream is stopped on unmount / when leaving the scanner
 * so there are no leaks; the ONNX model loads once and is reused.
 */
"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  INITIAL_MULTI_SCANNER_STATE,
  multiScannerReducer,
} from "./state";
import type { CapturedFrame } from "./types";
import { getProductDetector, type DetectionProgress } from "./detection";
import { getSharedProductMatcher } from "./matching";
import { getSharedFoodProfileAnalyzer } from "./profile-analyzer";
import { validateImageFile } from "@/lib/image/validation";

export function useMultiScanner() {
  const [state, dispatch] = useReducer(
    multiScannerReducer,
    INITIAL_MULTI_SCANNER_STATE,
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const statusRef = useRef(state.status);
  statusRef.current = state.status;
  const frameRef = useRef<CapturedFrame | null>(state.capturedFrame);
  frameRef.current = state.capturedFrame;
  const stateRef = useRef(state);
  stateRef.current = state;

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
    if (statusRef.current !== "IDLE") dispatch({ type: "CAMERA_STOPPED" });
  }, []);

  /**
   * Release camera hardware without touching scanner state (used when a
   * frame is captured so the camera light doesn't stay on behind the
   * review screen; Retake re-acquires via startCamera).
   */
  const pauseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    dispatch({ type: "CAMERA_REQUESTED" });

    // Stop any previous stream before requesting a new one.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Non-secure contexts (plain HTTP) have no mediaDevices — same guard as
    // the existing ScannerViewport.
    if (!navigator.mediaDevices?.getUserMedia) {
      dispatch({ type: "CAMERA_UNSUPPORTED" });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        // Wait for metadata before playing to avoid interrupted-play errors.
        video.onloadedmetadata = () => {
          video.play().catch(() => {
            // Autoplay with `muted + playsInline` virtually always succeeds;
            // a failure here is non-fatal (user can still see the frame).
          });
        };
      }
      dispatch({ type: "CAMERA_GRANTED" });
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const name = (err as { name?: string })?.name ?? "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        dispatch({ type: "PERMISSION_DENIED" });
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        dispatch({ type: "CAMERA_UNSUPPORTED" });
      } else {
        dispatch({ type: "CAMERA_FAILED" });
      }
    }
  }, []);

  /** Capture the current live frame into scanner state (no backend upload). */
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (
      !video ||
      (statusRef.current !== "SCANNING" &&
        statusRef.current !== "CAMERA_READY") ||
      video.videoWidth === 0
    ) {
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame: CapturedFrame = {
      dataUrl: canvas.toDataURL("image/jpeg", 0.9),
      width: canvas.width,
      height: canvas.height,
      capturedAt: Date.now(),
    };
    dispatch({ type: "FRAME_CAPTURED", frame });
    pauseStream();
  }, [pauseStream]);

  const retake = useCallback(() => {
    dispatch({ type: "RETAKE" });
  }, []);

  /**
   * Run real product detection on the captured frame (Phase 2).
   * One-shot on the still frame — never continuous on the live stream.
   * Safe to call repeatedly; only a captured/error/empty frame starts a run.
   */
  const runDetection = useCallback(
    async (onProgress?: DetectionProgress["onProgress"]) => {
      const frame = frameRef.current;
      if (!frame) return;
      const status = statusRef.current;
      if (
        status !== "CAPTURED" &&
        status !== "DETECTION_ERROR" &&
        status !== "NO_PRODUCTS_DETECTED"
      ) {
        return;
      }
      dispatch({ type: "DETECTION_STARTED" });
      try {
        const detector = getProductDetector();
        const detections = await detector.detect(
          { dataUrl: frame.dataUrl, width: frame.width, height: frame.height },
          onProgress,
        );
        if (!mountedRef.current) return;
        dispatch({ type: "DETECTION_SUCCEEDED", detections });
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        const message =
          err instanceof Error ? err.message : "Detection failed unexpectedly.";
        dispatch({ type: "DETECTION_FAILED", message });
      }
    },
    [],
  );

  /**
   * Fallback for camera-denied / camera-less environments: reuse the
   * existing FoodGuard image-validation pipeline and store the chosen file
   * as the captured frame (still local-only in Phase 1).
   * Returns an error string when the file is invalid, else null.
   */
  const captureFromUpload = useCallback(async (file: File): Promise<string | null> => {
    const validation = validateImageFile(file);
    if (!validation.valid) return validation.error ?? "Invalid file";

    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
    if (!dataUrl) return "Could not read that image. Please try another.";

    const dims = await new Promise<{ width: number; height: number }>(
      (resolve) => {
        const img = new Image();
        img.onload = () =>
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = dataUrl;
      },
    );

    // Stop the live camera if it is running — the uploaded frame replaces it.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;

    dispatch({ type: "CAMERA_REQUESTED" });
    dispatch({ type: "CAMERA_GRANTED" });
    dispatch({
      type: "FRAME_CAPTURED",
      frame: {
        dataUrl,
        width: dims.width,
        height: dims.height,
        capturedAt: Date.now(),
      },
    });
    return null;
  }, []);

  // Stop the camera when leaving the scanner + on unmount (no leaks).
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  /**
   * Identify every detection via crop → embed → FAISS (Phase 3).
   * Sequential with streaming progress; one product's failure never fails
   * the others. Safe to call repeatedly; only valid states start a run.
   */
  const runMatching = useCallback(async () => {
    const frame = frameRef.current;
    if (!frame) return;
    const status = statusRef.current;
    if (
      status !== "PRODUCTS_DETECTED" &&
      status !== "MATCHING_ERROR" &&
      status !== "MATCHES_READY"
    ) {
      return;
    }
    // Snapshot detections at run start so late detection changes can't
    // misalign crops with results.
    const current = stateRef.current;
    dispatch({ type: "MATCHING_STARTED" });
    try {
      const matcher = getSharedProductMatcher();
      const matches = await matcher.match(frame, current.detections, (p) => {
        if (!mountedRef.current) return;
        dispatch({ type: "MATCHING_PROGRESS", matches: p.matches });
      });
      if (!mountedRef.current) return;
      dispatch({ type: "MATCHING_SUCCEEDED", matches });
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const message =
        err instanceof Error ? err.message : "Identification failed unexpectedly.";
      dispatch({ type: "MATCHING_FAILED", message });
    }
  }, []);

  /** Explicit user confirmation of one candidate (never automatic). */
  const confirmProduct = useCallback((detectionId: string, candidateIndex: number) => {
    dispatch({ type: "PRODUCT_CONFIRMED", detectionId, candidateIndex });
  }, []);

  /**
   * Analyze confirmed products into structured food profiles (Phase 4).
   * Only matches with a confirmed identity enter the pipeline; everything
   * else is skipped (never analyzed as a known product).
   */
  const runAnalysis = useCallback(async () => {
    const status = statusRef.current;
    if (
      status !== "MATCHES_READY" &&
      status !== "ANALYSIS_ERROR" &&
      status !== "PROFILES_READY"
    ) {
      return;
    }
    const confirmed = stateRef.current.matches.filter(
      (m) => m.confirmedProductId && m.confirmedProductName,
    );
    dispatch({ type: "ANALYSIS_STARTED" });
    try {
      const analyzer = getSharedFoodProfileAnalyzer();
      const profiles = await analyzer.analyze(
        confirmed.map((m) => ({
          detectionId: m.detectionId,
          productId: m.confirmedProductId as string,
          productName: m.confirmedProductName as string,
          image: m.cropImage,
        })),
        (p) => {
          if (!mountedRef.current) return;
          dispatch({ type: "ANALYSIS_PROGRESS", profiles: p.profiles });
        },
      );
      if (!mountedRef.current) return;
      dispatch({ type: "ANALYSIS_SUCCEEDED", profiles });
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const message =
        err instanceof Error ? err.message : "Analysis failed unexpectedly.";
      dispatch({ type: "ANALYSIS_FAILED", message });
    }
  }, []);

  return {
    state,
    videoRef,
    startCamera,
    stopCamera,
    pauseStream,
    captureFrame,
    retake,
    captureFromUpload,
    runDetection,
    runMatching,
    confirmProduct,
    runAnalysis,
  };
}

export type UseMultiScanner = ReturnType<typeof useMultiScanner>;
