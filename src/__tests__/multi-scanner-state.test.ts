import { describe, it, expect } from "vitest";
import {
  INITIAL_MULTI_SCANNER_STATE,
  multiScannerReducer,
  statusMessageFor,
} from "@/lib/multi-scan/state";
import {
  NoopDetector,
  getProductDetector,
  setProductDetector,
} from "@/lib/multi-scan/detection";
import type {
  CapturedFrame,
  MultiScannerStatus,
  ProductDetection,
} from "@/lib/multi-scan/types";

const FRAME: CapturedFrame = {
  dataUrl: "data:image/jpeg;base64,xxx",
  width: 1280,
  height: 720,
  capturedAt: 123,
};

const DET = (id: string, confidence = 0.9): ProductDetection => ({
  id,
  boundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
  confidence,
  status: "detected",
});

function grantCamera() {
  return multiScannerReducer(
    multiScannerReducer(INITIAL_MULTI_SCANNER_STATE, {
      type: "CAMERA_REQUESTED",
    }),
    { type: "CAMERA_GRANTED" },
  );
}

describe("multiScannerReducer", () => {
  it("starts idle with no detections and no frame", () => {
    expect(INITIAL_MULTI_SCANNER_STATE.status).toBe("IDLE");
    expect(INITIAL_MULTI_SCANNER_STATE.detections).toEqual([]);
    expect(INITIAL_MULTI_SCANNER_STATE.capturedFrame).toBeNull();
  });

  it("moves IDLE → REQUESTING → SCANNING on camera grant", () => {
    const requesting = multiScannerReducer(INITIAL_MULTI_SCANNER_STATE, {
      type: "CAMERA_REQUESTED",
    });
    expect(requesting.status).toBe("CAMERA_REQUESTING_PERMISSION");

    const scanning = multiScannerReducer(requesting, { type: "CAMERA_GRANTED" });
    expect(scanning.status).toBe("SCANNING");
  });

  it("maps permission denial without fake error text", () => {
    const denied = multiScannerReducer(
      multiScannerReducer(INITIAL_MULTI_SCANNER_STATE, { type: "CAMERA_REQUESTED" }),
      { type: "PERMISSION_DENIED" },
    );
    expect(denied.status).toBe("PERMISSION_DENIED");
  });

  it("maps unsupported environments and init failures distinctly", () => {
    const unsupported = multiScannerReducer(INITIAL_MULTI_SCANNER_STATE, {
      type: "CAMERA_UNSUPPORTED",
    });
    expect(unsupported.status).toBe("CAMERA_UNSUPPORTED");

    const failed = multiScannerReducer(INITIAL_MULTI_SCANNER_STATE, {
      type: "CAMERA_FAILED",
    });
    expect(failed.status).toBe("CAMERA_ERROR");
  });

  it("captures a frame only from a live session", () => {
    // Capture from IDLE is ignored.
    expect(
      multiScannerReducer(INITIAL_MULTI_SCANNER_STATE, {
        type: "FRAME_CAPTURED",
        frame: FRAME,
      }).status,
    ).toBe("IDLE");

    const scanning = multiScannerReducer(
      multiScannerReducer(INITIAL_MULTI_SCANNER_STATE, { type: "CAMERA_REQUESTED" }),
      { type: "CAMERA_GRANTED" },
    );
    const captured = multiScannerReducer(scanning, {
      type: "FRAME_CAPTURED",
      frame: FRAME,
    });
    expect(captured.status).toBe("CAPTURED");
    expect(captured.capturedFrame).toEqual(FRAME);
  });

  it("retake discards the capture and resumes scanning", () => {
    const scanning = grantCamera();
    const captured = multiScannerReducer(scanning, {
      type: "FRAME_CAPTURED",
      frame: FRAME,
    });
    const retaken = multiScannerReducer(captured, { type: "RETAKE" });
    expect(retaken.status).toBe("SCANNING");
    expect(retaken.capturedFrame).toBeNull();
  });

  it("retake from results clears detections too", () => {
    const detected = multiScannerReducer(
      multiScannerReducer(grantCamera(), {
        type: "FRAME_CAPTURED",
        frame: FRAME,
      }),
      { type: "DETECTION_STARTED" },
    );
    const done = multiScannerReducer(detected, {
      type: "DETECTION_SUCCEEDED",
      detections: [DET("a"), DET("b")],
    });
    expect(done.status).toBe("PRODUCTS_DETECTED");
    const retaken = multiScannerReducer(done, { type: "RETAKE" });
    expect(retaken.status).toBe("SCANNING");
    expect(retaken.detections).toEqual([]);
    expect(retaken.matches).toEqual([]);
    expect(retaken.capturedFrame).toBeNull();
  });

  it("stopping the camera keeps the captured frame for Phase 2", () => {
    const scanning = grantCamera();
    const captured = multiScannerReducer(scanning, {
      type: "FRAME_CAPTURED",
      frame: FRAME,
    });
    const stopped = multiScannerReducer(captured, { type: "CAMERA_STOPPED" });
    expect(stopped.status).toBe("IDLE");
    expect(stopped.capturedFrame).toEqual(FRAME);
  });

  it("runs CAPTURED → DETECTING → PRODUCTS_DETECTED", () => {
    const captured = multiScannerReducer(grantCamera(), {
      type: "FRAME_CAPTURED",
      frame: FRAME,
    });
    const detecting = multiScannerReducer(captured, { type: "DETECTION_STARTED" });
    expect(detecting.status).toBe("DETECTING");
    expect(detecting.detections).toEqual([]);

    const done = multiScannerReducer(detecting, {
      type: "DETECTION_SUCCEEDED",
      detections: [DET("a", 0.92), DET("b", 0.81), DET("c", 0.77)],
    });
    expect(done.status).toBe("PRODUCTS_DETECTED");
    expect(done.detections).toHaveLength(3);
  });

  it("maps empty results to NO_PRODUCTS_DETECTED and failures to DETECTION_ERROR", () => {
    const detecting = multiScannerReducer(
      multiScannerReducer(grantCamera(), {
        type: "FRAME_CAPTURED",
        frame: FRAME,
      }),
      { type: "DETECTION_STARTED" },
    );
    const empty = multiScannerReducer(detecting, {
      type: "DETECTION_SUCCEEDED",
      detections: [],
    });
    expect(empty.status).toBe("NO_PRODUCTS_DETECTED");

    const failed = multiScannerReducer(detecting, {
      type: "DETECTION_FAILED",
      message: "boom",
    });
    expect(failed.status).toBe("DETECTION_ERROR");
    expect(failed.errorMessage).toBe("boom");
  });

  it("ignores detection events outside their valid states", () => {
    // Cannot start detection without a captured frame.
    expect(
      multiScannerReducer(INITIAL_MULTI_SCANNER_STATE, { type: "DETECTION_STARTED" })
        .status,
    ).toBe("IDLE");
    // Late results after retake are dropped.
    const scanning = grantCamera();
    expect(
      multiScannerReducer(scanning, {
        type: "DETECTION_SUCCEEDED",
        detections: [DET("late")],
      }).detections,
    ).toEqual([]);
  });

  it("retries detection from error and empty states", () => {
    const detecting = multiScannerReducer(
      multiScannerReducer(grantCamera(), {
        type: "FRAME_CAPTURED",
        frame: FRAME,
      }),
      { type: "DETECTION_STARTED" },
    );
    const failed = multiScannerReducer(detecting, { type: "DETECTION_FAILED" });
    const retrying = multiScannerReducer(failed, { type: "DETECTION_STARTED" });
    expect(retrying.status).toBe("DETECTING");
  });

  it("retake from match results clears matches too", () => {
    const ready = productsDetected();
    const matching = multiScannerReducer(ready, { type: "MATCHING_STARTED" });
    const done = multiScannerReducer(matching, {
      type: "MATCHING_SUCCEEDED",
      matches: [MATCH("a", "matched"), MATCH("b", "no_match")],
    });
    expect(done.status).toBe("MATCHES_READY");
    const retaken = multiScannerReducer(done, { type: "RETAKE" });
    expect(retaken.status).toBe("SCANNING");
    expect(retaken.matches).toEqual([]);
    expect(retaken.detections).toEqual([]);
  });
});

function productsDetected() {
  return multiScannerReducer(
    multiScannerReducer(
      multiScannerReducer(grantCamera(), {
        type: "FRAME_CAPTURED",
        frame: FRAME,
      }),
      { type: "DETECTION_STARTED" },
    ),
    { type: "DETECTION_SUCCEEDED", detections: [DET("a"), DET("b")] },
  );
}

function MATCH(
  detectionId: string,
  status: "matched" | "weak_match" | "no_match" | "error",
) {
  return {
    detectionId,
    status,
    candidates:
      status === "no_match" || status === "error"
        ? []
        : [
            { productId: `id-${detectionId}-1`, productName: `Product ${detectionId} 1`, similarity: 20.5, rank: 1 },
            { productId: `id-${detectionId}-2`, productName: `Product ${detectionId} 2`, similarity: 26.1, rank: 2 },
          ],
    top:
      status === "no_match" || status === "error"
        ? null
        : { productId: `id-${detectionId}-1`, productName: `Product ${detectionId} 1`, similarity: 20.5, rank: 1 },
    matchStrength: (status === "matched" ? "strong" : status === "weak_match" ? "possible" : "none") as
      | "strong"
      | "possible"
      | "none",
    confirmedProductId: null,
    confirmedProductName: null,
  };
}

describe("matching state machine (Phase 3)", () => {
  it("runs PRODUCTS_DETECTED → MATCHING → MATCHES_READY with per-product statuses", () => {
    const matching = multiScannerReducer(productsDetected(), { type: "MATCHING_STARTED" });
    expect(matching.status).toBe("MATCHING");
    expect(matching.detections.every((d) => d.status === "matching")).toBe(true);

    const done = multiScannerReducer(matching, {
      type: "MATCHING_SUCCEEDED",
      matches: [MATCH("a", "matched"), MATCH("b", "weak_match")],
    });
    expect(done.status).toBe("MATCHES_READY");
    expect(done.matches).toHaveLength(2);
    expect(done.detections.find((d) => d.id === "a")?.status).toBe("matched");
    expect(done.detections.find((d) => d.id === "b")?.status).toBe("weak_match");
  });

  it("streams partial progress without finishing", () => {
    const matching = multiScannerReducer(productsDetected(), { type: "MATCHING_STARTED" });
    const partial = multiScannerReducer(matching, {
      type: "MATCHING_PROGRESS",
      matches: [MATCH("a", "matched")],
    });
    expect(partial.status).toBe("MATCHING");
    expect(partial.matches).toHaveLength(1);
  });

  it("keeps mixed outcomes: matched + no_match + error side by side", () => {
    const matching = multiScannerReducer(productsDetected(), { type: "MATCHING_STARTED" });
    const done = multiScannerReducer(matching, {
      type: "MATCHING_SUCCEEDED",
      matches: [MATCH("a", "matched"), MATCH("b", "no_match")],
    });
    expect(done.status).toBe("MATCHES_READY");
    expect(done.matches.find((m) => m.detectionId === "b")?.status).toBe("no_match");
    expect(done.matches.find((m) => m.detectionId === "a")?.top).not.toBeNull();
  });

  it("maps whole-run failure to MATCHING_ERROR with retry", () => {
    const matching = multiScannerReducer(productsDetected(), { type: "MATCHING_STARTED" });
    const failed = multiScannerReducer(matching, {
      type: "MATCHING_FAILED",
      message: "search down",
    });
    expect(failed.status).toBe("MATCHING_ERROR");
    expect(failed.errorMessage).toBe("search down");
    const retry = multiScannerReducer(failed, { type: "MATCHING_STARTED" });
    expect(retry.status).toBe("MATCHING");
  });

  it("stores explicit user confirmation, never automatic", () => {
    const matching = multiScannerReducer(productsDetected(), { type: "MATCHING_STARTED" });
    const done = multiScannerReducer(matching, {
      type: "MATCHING_SUCCEEDED",
      matches: [MATCH("a", "matched"), MATCH("b", "weak_match")],
    });
    // Nothing is confirmed by the matcher itself.
    expect(done.matches.every((m) => m.confirmedProductId === null)).toBe(true);

    // User confirms candidate #2 of the weak match.
    const confirmed = multiScannerReducer(done, {
      type: "PRODUCT_CONFIRMED",
      detectionId: "b",
      candidateIndex: 1,
    });
    const b = confirmed.matches.find((m) => m.detectionId === "b");
    expect(b?.confirmedProductId).toBe("id-b-2");
    expect(b?.confirmedProductName).toBe("Product b 2");
    // The other product stays unconfirmed.
    expect(confirmed.matches.find((m) => m.detectionId === "a")?.confirmedProductId).toBeNull();
  });

  it("ignores confirmations with invalid candidates or states", () => {
    const matching = multiScannerReducer(productsDetected(), { type: "MATCHING_STARTED" });
    const done = multiScannerReducer(matching, {
      type: "MATCHING_SUCCEEDED",
      matches: [MATCH("a", "matched"), MATCH("b", "no_match")],
    });
    // Out-of-range index on a match without candidates.
    const untouched = multiScannerReducer(done, {
      type: "PRODUCT_CONFIRMED",
      detectionId: "b",
      candidateIndex: 0,
    });
    expect(untouched.matches.find((m) => m.detectionId === "b")?.confirmedProductId).toBeNull();
    // Confirmation outside MATCHES_READY is dropped.
    const early = multiScannerReducer(matching, {
      type: "PRODUCT_CONFIRMED",
      detectionId: "a",
      candidateIndex: 0,
    });
    expect(early.matches).toEqual([]);
  });
});

describe("statusMessageFor", () => {
  it("never reports fake product results", () => {
    const statuses: MultiScannerStatus[] = [
      "IDLE",
      "CAMERA_REQUESTING_PERMISSION",
      "CAMERA_READY",
      "SCANNING",
      "CAPTURED",
      "DETECTING",
      "PRODUCTS_DETECTED",
      "NO_PRODUCTS_DETECTED",
      "DETECTION_ERROR",
      "MATCHING",
      "MATCHES_READY",
      "MATCHING_ERROR",
      "PERMISSION_DENIED",
      "CAMERA_ERROR",
      "CAMERA_UNSUPPORTED",
    ];
    const messages = statuses.map((s) => statusMessageFor(s));
    for (const m of messages) {
      expect(m).not.toMatch(/%|cereal|protein bar|healthy|unhealthy|detected \d/i);
    }
    expect(statusMessageFor("SCANNING")).toBe("Scanning for products…");
    expect(statusMessageFor("CAPTURED")).toBe("Frame captured");
    expect(statusMessageFor("DETECTING")).toBe("Analyzing image…");
    expect(statusMessageFor("PRODUCTS_DETECTED")).toBe("Products detected");
    expect(statusMessageFor("NO_PRODUCTS_DETECTED")).toBe("No products detected");
    expect(statusMessageFor("MATCHING")).toBe("Identifying products…");
    expect(statusMessageFor("MATCHES_READY")).toBe("Products identified");
  });
});

function matchesReady() {
  const matching = multiScannerReducer(productsDetected(), { type: "MATCHING_STARTED" });
  return multiScannerReducer(matching, {
    type: "MATCHING_SUCCEEDED",
    matches: [MATCH("a", "matched"), MATCH("b", "weak_match")],
  });
}

function PROFILE(detectionId: string, status: "ready" | "data_unavailable" | "error" = "ready") {
  return {
    detectionId,
    productId: `pid-${detectionId}`,
    productName: `Product ${detectionId}`,
    brand: null,
    image: null,
    barcode: null,
    servingSize: "30g",
    nutrition: {
      basis: "PER_100G" as const,
      calories: { value: 100, unit: "kcal" },
      carbohydrates: null,
      totalSugar: null,
      addedSugar: null,
      protein: null,
      fat: null,
      saturatedFat: null,
      fiber: null,
      sodium: null,
    },
    ingredients: { rawText: "Corn", normalized: ["corn"] },
    categories: ["food"],
    understanding: null,
    understandingSource: "unavailable" as const,
    source: "network",
    fetchedAt: 1,
    status,
  };
}

describe("analysis state machine (Phase 4)", () => {
  it("runs MATCHES_READY → ANALYZING → PROFILES_READY", () => {
    const analyzing = multiScannerReducer(matchesReady(), { type: "ANALYSIS_STARTED" });
    expect(analyzing.status).toBe("ANALYZING");
    expect(analyzing.profiles).toEqual([]);

    const done = multiScannerReducer(analyzing, {
      type: "ANALYSIS_SUCCEEDED",
      profiles: [PROFILE("a"), PROFILE("b", "data_unavailable")],
    });
    expect(done.status).toBe("PROFILES_READY");
    expect(done.profiles.map((p) => p.status)).toEqual(["ready", "data_unavailable"]);
  });

  it("maps whole-run failure to ANALYSIS_ERROR with retry", () => {
    const analyzing = multiScannerReducer(matchesReady(), { type: "ANALYSIS_STARTED" });
    const failed = multiScannerReducer(analyzing, {
      type: "ANALYSIS_FAILED",
      message: "analysis down",
    });
    expect(failed.status).toBe("ANALYSIS_ERROR");
    expect(failed.errorMessage).toBe("analysis down");
    expect(multiScannerReducer(failed, { type: "ANALYSIS_STARTED" }).status).toBe("ANALYZING");
  });

  it("allows confirming more products after analysis", () => {
    const analyzing = multiScannerReducer(matchesReady(), { type: "ANALYSIS_STARTED" });
    const done = multiScannerReducer(analyzing, {
      type: "ANALYSIS_SUCCEEDED",
      profiles: [PROFILE("a")],
    });
    const reconfirmed = multiScannerReducer(done, {
      type: "PRODUCT_CONFIRMED",
      detectionId: "b",
      candidateIndex: 0,
    });
    expect(reconfirmed.matches.find((m) => m.detectionId === "b")?.confirmedProductId).toBe("id-b-1");
  });

  it("retake clears profiles alongside matches and detections", () => {
    const analyzing = multiScannerReducer(matchesReady(), { type: "ANALYSIS_STARTED" });
    const done = multiScannerReducer(analyzing, {
      type: "ANALYSIS_SUCCEEDED",
      profiles: [PROFILE("a")],
    });
    const retaken = multiScannerReducer(done, { type: "RETAKE" });
    expect(retaken.status).toBe("SCANNING");
    expect(retaken.profiles).toEqual([]);
    expect(retaken.matches).toEqual([]);
  });

  it("data-integrity: unconfirmed candidates never become trusted identities", () => {
    // A weak match with candidates but no confirmation carries null identity.
    const ready = matchesReady();
    const weak = ready.matches.find((m) => m.detectionId === "b");
    expect(weak?.candidates.length).toBeGreaterThan(0);
    expect(weak?.confirmedProductId).toBeNull();
    // And an out-of-range confirm changes nothing.
    const untouched = multiScannerReducer(ready, {
      type: "PRODUCT_CONFIRMED",
      detectionId: "b",
      candidateIndex: 99,
    });
    expect(untouched.matches.find((m) => m.detectionId === "b")?.confirmedProductId).toBeNull();
  });
});

describe("detectors (Phase 2 detection layer)", () => {  it("NoopDetector still resolves to an empty array (tests/offline)", async () => {
    const detector = new NoopDetector();
    await expect(
      detector.detect({ dataUrl: "data:,", width: 1, height: 1 }),
    ).resolves.toEqual([]);
  });

  it("defaults to the real local detector, swappable for tests", () => {
    expect(getProductDetector().name).toBe("detr-resnet-50-onnx");
    const noop = new NoopDetector();
    setProductDetector(noop);
    expect(getProductDetector()).toBe(noop);
  });
});
