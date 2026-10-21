/**
 * Multi-Product Scanner — Phase 3 experience.
 *
 * Flow: camera → Capture → DETECTING → bounding boxes →
 * MATCHING ("Identifying products… n/m") → per-product match cards with
 * top candidates → user taps box ↔ card sync → explicit [Confirm] stores
 * the trusted identity for Phase 4.
 *
 * Identification is VISUAL similarity only (crop → CLIP → FAISS): no names
 * are invented, no health/nutrition/personal scores are shown anywhere.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  RotateCcw,
  Upload,
  AlertCircle,
  ScanSearch,
  MousePointerClick,
  Check,
  ListOrdered,
  Search,
  BadgeCheck,
  Loader2,
} from "lucide-react";
import { useMultiScanner } from "@/lib/multi-scan/useMultiScanner";
import { statusMessageFor } from "@/lib/multi-scan/state";
import type { ProductMatch } from "@/lib/multi-scan/matching";
import { MultiScanViewport } from "./MultiScanViewport";
import { DetectionOverlay } from "./DetectionOverlay";
import { FoodProfileCard } from "./FoodProfileCard";
import { PersonalFitCard } from "./PersonalFitCard";
import { ComparisonTable } from "./ComparisonTable";
import { usePersonalDecisions } from "@/lib/personalization/use-personal-decisions";
import { compareProducts } from "@/lib/personalization/comparison";
import { logConsumption, type LogConsumptionInput } from "@/lib/personalization/daily-log";
import type { PersonalDecision } from "@/lib/personalization/decision-engine";
import { ScanTips } from "../ScanTips";
import { cn } from "@/lib/utils";

const MULTI_SCAN_TIPS = [
  "Place multiple products inside the scanning area.",
  "Hold your camera steady with good lighting.",
  "Avoid glare and keep labels facing the camera.",
  "Capture once the shelf or products are clearly visible.",
];

function matchStrengthLabel(match: ProductMatch): string {
  if (match.status === "matched") return "Visual match: Strong";
  if (match.status === "weak_match") return "Possible match";
  if (match.status === "no_match") return "Not confidently identified";
  return "Identification failed";
}

export function MultiProductScanner() {
  const router = useRouter();
  const {
    state,
    videoRef,
    startCamera,
    stopCamera,
    captureFrame,
    retake,
    captureFromUpload,
    runDetection,
    runMatching,
    confirmProduct,
    runAnalysis,
  } = useMultiScanner();
  const { status, capturedFrame, detections, matches, profiles, errorMessage } = state;

  // Phase 5: personal decisions are computed from confirmed profiles + the
  // user's stored goals/restrictions + today's local log. The hook only runs
  // when `profiles` changes, so no AI call happens during a camera render.
  const { getDecision, isPending, refresh, state: decisionState, context: decisionContext } =
    usePersonalDecisions(profiles);
  const decisionError = decisionState.error;

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [matchProgress, setMatchProgress] = useState<{ completed: number; total: number } | null>(null);
  const [showCandidates, setShowCandidates] = useState(false);
  const [pendingCandidate, setPendingCandidate] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Today's logged product ids, so a card can show "Logged to today" and a
  // re-log is idempotent anyway.
  const [loggedIds, setLoggedIds] = useState<string[]>([]);
  const loggedTodayFor = useCallback(
    (match: (d: PersonalDecision) => boolean) => {
      for (const d of decisionState.byProductId.values()) {
        if (match(d) && loggedIds.includes(d.productId)) return true;
      }
      return false;
    },
    [decisionState.byProductId, loggedIds],
  );

  // Log a decision's serving into the local daily intake log, then force a
  // recompute so every card on the shelf reflects the new total.
  const logDecision = useCallback(
    (decision: PersonalDecision) => {
      const nutrients: Partial<Record<string, number | null>> = {};
      for (const impact of decision.analysis.impacts) nutrients[impact.key] = impact.productAmount;
      const today = logConsumption({
        productId: decision.productId,
        productName: decision.productName,
        nutrients: nutrients as LogConsumptionInput["nutrients"],
      });
      setLoggedIds(today.consumedFoods.map((f) => f.productId));
      void refresh();
    },
    [refresh],
  );

  // Comparison across the whole shelf, using the same decisions.
  const comparison = useMemo(() => {
    if (decisionState.byProductId.size < 2) return null;
    return compareProducts([...decisionState.byProductId.values()], decisionContext);
  }, [decisionState.byProductId, decisionContext]);
  // Guards the auto-run effects (StrictMode double-invoke + re-renders).
  const detectedForFrameRef = useRef<number | null>(null);
  const matchedForDetectionsRef = useRef<string | null>(null);
  const analyzedForConfirmedRef = useRef<string | null>(null);

  // Open the camera as soon as the scanner mounts; release it on unmount.
  useEffect(() => {
    void startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // Capture → automatically run real detection on the still frame (one-shot,
  // never continuous on the live stream).
  useEffect(() => {
    if (status !== "CAPTURED" || !capturedFrame) return;
    if (detectedForFrameRef.current === capturedFrame.capturedAt) return;
    detectedForFrameRef.current = capturedFrame.capturedAt;
    setSelectedId(null);
    setModelLoading(true);
    void runDetection(({ phase }) => {
      if (phase === "analyzing") setModelLoading(false);
    }).finally(() => setModelLoading(false));
  }, [status, capturedFrame, runDetection]);

  // Detections ready → automatically identify every product (one-shot).
  useEffect(() => {
    if (status !== "PRODUCTS_DETECTED") return;
    const key = detections.map((d) => d.id).join(",");
    if (matchedForDetectionsRef.current === key) return;
    matchedForDetectionsRef.current = key;
    setMatchProgress({ completed: 0, total: detections.length });
    void runMatching().finally(() => setMatchProgress(null));
  }, [status, detections, runMatching]);

  // Reset candidate picker whenever the selection changes.
  useEffect(() => {
    setShowCandidates(false);
    setPendingCandidate(0);
  }, [selectedId]);

  // Confirmed identities → automatically build structured food profiles.
  // Only confirmed products enter analysis; weak unconfirmed matches show
  // "Confirm product to analyze" instead.
  useEffect(() => {
    if (status !== "MATCHES_READY" && status !== "PROFILES_READY") return;
    const confirmed = matches.filter((m) => m.confirmedProductId && m.confirmedProductName);
    if (confirmed.length === 0) return;
    const key = confirmed.map((m) => `${m.detectionId}:${m.confirmedProductId}`).join("|");
    if (analyzedForConfirmedRef.current === key) return;
    analyzedForConfirmedRef.current = key;
    void runAnalysis();
  }, [status, matches, runAnalysis]);

  const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    const err = await captureFromUpload(file);
    if (err) setUploadError(err);
  };

  const handleBack = () => {
    stopCamera();
    router.push("/scan");
  };

  const handleRetake = () => {
    setSelectedId(null);
    setMatchProgress(null);
    retake();
    // Re-attach the live stream to the (newly mounted) video element.
    void startCamera();
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  const isLive = status === "SCANNING" || status === "CAMERA_READY";
  const showVideo = isLive || status === "CAMERA_REQUESTING_PERMISSION";
  const hasResultFrame =
    capturedFrame &&
    (status === "CAPTURED" ||
      status === "DETECTING" ||
      status === "PRODUCTS_DETECTED" ||
      status === "NO_PRODUCTS_DETECTED" ||
      status === "DETECTION_ERROR" ||
      status === "MATCHING" ||
      status === "MATCHES_READY" ||
      status === "MATCHING_ERROR" ||
      status === "ANALYZING" ||
      status === "PROFILES_READY" ||
      status === "ANALYSIS_ERROR");
  const showBoxes =
    status === "PRODUCTS_DETECTED" ||
    status === "MATCHING" ||
    status === "MATCHES_READY" ||
    status === "ANALYZING" ||
    status === "PROFILES_READY" ||
    status === "ANALYSIS_ERROR";

  const selectedIndex = detections.findIndex((d) => d.id === selectedId);
  const selectedMatch =
    selectedIndex >= 0 ? (matches.find((m) => m.detectionId === selectedId) ?? null) : null;
  const selectedProfile =
    selectedIndex >= 0 ? (profiles.find((p) => p.detectionId === selectedId) ?? null) : null;
  // Progress is derived from reducer state (ANALYSIS_PROGRESS accumulates
  // completed profiles) rather than a local counter that can drift.
  const confirmedTotal = matches.filter((m) => m.confirmedProductId && m.confirmedProductName).length;

  const renderProfileBlock = () => {
    // Per-product analysis checklist (honest states, no fake percentages).
    if (status === "ANALYZING" && !selectedProfile) {
      return (
        <div className="flex flex-col gap-1.5 rounded-xl bg-muted/50 px-4 py-3 text-sm">
          <p className="text-foreground">✓ Product identified</p>
          <p className="text-muted-foreground">⏳ Loading nutrition…</p>
        </div>
      );
    }
    if (!selectedProfile) return null;

    if (selectedProfile.status === "ready" || selectedProfile.status === "understanding_failed") {
      const decision = getDecision(selectedProfile.productId);
      if (!decision) {
        return (
          <div className="flex flex-col gap-1.5 rounded-xl bg-muted/50 px-4 py-3 text-sm">
            <p className="text-foreground">Product facts ready</p>
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Placing it in your day…
            </p>
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-4">
          <FoodProfileCard profile={selectedProfile} />
          <PersonalFitCard
            decision={decision}
            refreshing={isPending(selectedProfile.productId)}
            onRefresh={() => void refresh(selectedProfile.productId)}
            onLog={(d) => logDecision(d)}
            loggedToday={loggedTodayFor(d => d.productId === decision.productId)}
          />
          {decisionError && (
            <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">
              {decisionError}
            </p>
          )}
        </div>
      );
    }
    if (selectedProfile.status === "data_unavailable") {
      return (
        <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Nutrition information unavailable.
        </p>
      );
    }
    // status "error" / "analyzing" with a partial profile.
    return (
      <div className="flex flex-col gap-2">
        <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          {selectedProfile.error ?? "Product analysis failed."}
        </p>
        <button
          type="button"
          onClick={() => {
            analyzedForConfirmedRef.current = null;
            void runAnalysis();
          }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Try Again
        </button>
      </div>
    );
  };

  const renderMatchPanel = () => {
    if (
      (status !== "MATCHES_READY" &&
        status !== "ANALYZING" &&
        status !== "PROFILES_READY" &&
        status !== "ANALYSIS_ERROR") ||
      selectedIndex < 0
    ) {
      return null;
    }
    const match = selectedMatch;
    const top = match?.top ?? null;
    const confirmed =
      !!match?.confirmedProductId &&
      match.confirmedProductId === match.candidates[pendingCandidate]?.productId;

    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          {match?.cropImage && (
            <img
              src={match.cropImage}
              alt={`Cropped view of detected product ${selectedIndex + 1}`}
              className="size-16 shrink-0 rounded-xl border border-border bg-muted object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-foreground">
              Product #{selectedIndex + 1}
            </h3>
            {top ? (
              <p className="mt-0.5 line-clamp-2 text-sm font-medium text-foreground">
                {top.productName}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Couldn&apos;t confidently identify this product.
              </p>
            )}
            {match && (match.status === "matched" || match.status === "weak_match") && (
              <p className="mt-1 text-xs text-muted-foreground">{matchStrengthLabel(match)}</p>
            )}
          </div>
        </div>

        {/* Candidate picker for weak matches / corrections */}
        {match && match.candidates.length > 1 && (
          <div className="flex flex-col gap-2">
            {!showCandidates ? (
              <button
                type="button"
                onClick={() => setShowCandidates(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <ListOrdered className="size-4" aria-hidden="true" />
                Choose another ({match.candidates.length} candidates)
              </button>
            ) : (
              <div className="flex flex-col gap-1.5">
                {match.candidates.map((c, i) => (
                  <button
                    key={c.productId}
                    type="button"
                    onClick={() => setPendingCandidate(i)}
                    aria-pressed={pendingCandidate === i}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors",
                      pendingCandidate === i
                        ? "border-primary bg-primary/5 font-medium text-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        pendingCandidate === i
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="line-clamp-2 flex-1">{c.productName}</span>
                    {pendingCandidate === i && (
                      <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {match?.status === "error" && (
          <p className="text-sm text-muted-foreground">
            {match.error ?? "Identification failed for this product."}
          </p>
        )}
        {match?.status === "no_match" && (
          <p className="text-sm text-muted-foreground">
            Try a clearer photo, or search for it manually below.
          </p>
        )}

        {match?.confirmedProductId ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900/50 dark:bg-green-950/40">
              <BadgeCheck
                className="size-5 shrink-0 text-green-600 dark:text-green-400"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Confirmed: {match.confirmedProductName}
              </p>
            </div>
            {renderProfileBlock()}
          </div>
        ) : (
          match &&
          top && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => confirmProduct(match.detectionId, pendingCandidate)}
                disabled={confirmed}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                <Check className="size-4" aria-hidden="true" />
                Confirm{match.candidates.length > 1 ? ` candidate #${pendingCandidate + 1}` : ""}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                Confirm product to analyze — unlocks nutrition, ingredients &amp; food understanding.
              </p>
            </div>
          )
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleRetake}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Retake
          </button>
          <button
            type="button"
            onClick={() => router.push("/search")}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Search className="size-4" aria-hidden="true" />
            Search Manually
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </button>
          <h1 className="text-sm font-semibold text-foreground">
            Multi-Product Scanner
          </h1>
          <div className="w-12" aria-hidden="true" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6 pb-nav-safe">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            FoodGuard
          </p>
          <h2 className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">
            Multi-Product Scanner
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Point your camera at food products
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={handleUploadChange}
        />

        {uploadError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="font-medium">{uploadError}</p>
          </div>
        )}

        {/* Live camera phase */}
        {!hasResultFrame && (
          <div className="flex flex-col gap-4">
            <MultiScanViewport
              status={status}
              videoRef={videoRef}
              showVideo={showVideo}
            />

            {/* Scanning status */}
            <div className="flex items-center justify-center gap-2">
              {isLive && (
                <span
                  className="size-2 animate-pulse rounded-full bg-primary"
                  aria-hidden="true"
                />
              )}
              <p className="text-sm font-medium text-foreground">
                {statusMessageFor(status)}
              </p>
            </div>
            {isLive && (
              <p className="-mt-2 text-center text-xs text-muted-foreground">
                Place multiple products inside this area.
              </p>
            )}

            {/* Permission denied */}
            {status === "PERMISSION_DENIED" && (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Camera className="size-4" aria-hidden="true" />
                  Enable Camera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <Upload className="size-4" aria-hidden="true" />
                  Upload Product Image
                </button>
              </div>
            )}

            {/* No camera / init failure */}
            {(status === "CAMERA_UNSUPPORTED" || status === "CAMERA_ERROR") && (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Camera className="size-4" aria-hidden="true" />
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <Upload className="size-4" aria-hidden="true" />
                  Upload Product Image
                </button>
              </div>
            )}

            {/* Idle / requesting */}
            {(status === "IDLE" || status === "CAMERA_REQUESTING_PERMISSION") && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Upload className="size-4" aria-hidden="true" />
                Upload Product Image
              </button>
            )}

            {/* Capture — large, thumb-friendly */}
            {isLive && (
              <button
                type="button"
                onClick={captureFrame}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 active:bg-primary/95"
              >
                <Camera className="size-5" aria-hidden="true" />
                Capture
              </button>
            )}
          </div>
        )}

        {/* Captured frame + detection + identification results */}
        {hasResultFrame && capturedFrame && (
          <div className="flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-black shadow-sm">
              <img
                src={capturedFrame.dataUrl}
                alt="Captured products frame"
                className="max-h-[50vh] w-full object-contain"
              />
              {showBoxes && (
                <DetectionOverlay
                  naturalWidth={capturedFrame.width || 1}
                  naturalHeight={capturedFrame.height || 1}
                  detections={detections}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                />
              )}
              {(status === "CAPTURED" || status === "DETECTING") && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                  <div className="flex flex-col items-center gap-3 px-6 text-center">
                    <div className="size-9 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <p className="text-sm font-medium text-white">
                      Analyzing image…
                    </p>
                    {modelLoading && (
                      <p className="text-xs text-white/70">
                        Loading detection model (first scan only)…
                      </p>
                    )}
                  </div>
                </div>
              )}
              {status === "MATCHING" && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 pt-8">
                  <div className="flex items-center justify-center gap-2">
                    <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <p className="text-sm font-medium text-white">
                      Identifying products…
                      {matchProgress && matchProgress.total > 0 && (
                        <> {matchProgress.completed} / {matchProgress.total}</>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Detection count (Phase 2 banner, kept) */}
            {(status === "PRODUCTS_DETECTED" || status === "MATCHING") && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
                <ScanSearch
                  className="size-5 text-foreground"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-foreground">
                  {detections.length === 1
                    ? "1 product detected"
                    : `${detections.length} products detected`}
                </p>
              </div>
            )}

            {/* Identified count */}
            {(status === "MATCHES_READY" ||
              status === "ANALYZING" ||
              status === "PROFILES_READY" ||
              status === "ANALYSIS_ERROR") && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
                <ScanSearch
                  className="size-5 text-foreground"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-foreground">
                  {matches.filter((m) => m.status === "matched").length} of{" "}
                  {detections.length} identified
                </p>
              </div>
            )}

            {/* Analysis progress (honest per-product counts) */}
            {status === "ANALYZING" && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
                <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm font-medium text-foreground">
                  Analyzing products…
                  {confirmedTotal > 0 && (
                    <> Product {Math.min(profiles.length + 1, confirmedTotal)} of {confirmedTotal}</>
                  )}
                </p>
              </div>
            )}

            {/* Tap prompt before selection */}
            {(status === "PRODUCTS_DETECTED" || status === "MATCHING") && !selectedId && (
              <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                <MousePointerClick className="size-4" aria-hidden="true" />
                Tap a highlighted region to select that product.
              </p>
            )}
            {status === "MATCHES_READY" && !selectedMatch && (
              <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                <MousePointerClick className="size-4" aria-hidden="true" />
                Tap a highlighted region to see its product matches.
              </p>
            )}
            {(status === "PROFILES_READY" || status === "ANALYZING") && !selectedMatch && (
              <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                <MousePointerClick className="size-4" aria-hidden="true" />
                Tap a highlighted region to see its food profile.
              </p>
            )}

            {/* Identification result card for the selected detection */}
            {(status === "MATCHES_READY" ||
              status === "ANALYZING" ||
              status === "PROFILES_READY" ||
              status === "ANALYSIS_ERROR") &&
              renderMatchPanel()}

            {/* Retake while matching */}
            {status === "MATCHING" && (
              <button
                type="button"
                onClick={handleRetake}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Retake
              </button>
            )}

            {/* No products detected */}
            {status === "NO_PRODUCTS_DETECTED" && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
                <h3 className="text-base font-semibold text-foreground">
                  No products detected
                </h3>
                <p className="text-sm text-muted-foreground">
                  Try moving the camera closer or make sure the products are
                  clearly visible.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Try Again
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <Upload className="size-4" aria-hidden="true" />
                    Upload Image
                  </button>
                </div>
              </div>
            )}

            {/* Detection failed */}
            {status === "DETECTION_ERROR" && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
                <h3 className="text-base font-semibold text-foreground">
                  Product detection failed
                </h3>
                <p className="text-sm text-muted-foreground">
                  {errorMessage ??
                    "The image could not be analyzed. Check your connection (first scan downloads the model) and try again."}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setModelLoading(true);
                      void runDetection(({ phase }) => {
                        if (phase === "analyzing") setModelLoading(false);
                      }).finally(() => setModelLoading(false));
                    }}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Try Again
                  </button>
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <Camera className="size-4" aria-hidden="true" />
                    Retake
                  </button>
                </div>
              </div>
            )}

            {/* Matching failed (whole run) */}
            {status === "MATCHING_ERROR" && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
                <h3 className="text-base font-semibold text-foreground">
                  Couldn&apos;t identify these products
                </h3>
                <p className="text-sm text-muted-foreground">
                  {errorMessage ??
                    "Product search is unavailable right now. Check your connection and try again."}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setMatchProgress({ completed: 0, total: detections.length });
                      void runMatching().finally(() => setMatchProgress(null));
                    }}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Try Again
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/search")}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <Search className="size-4" aria-hidden="true" />
                    Search Manually
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <Upload className="size-4" aria-hidden="true" />
                    Upload Clearer Image
                  </button>
                </div>
              </div>
            )}

            {/* Analysis failed (whole run) */}
            {status === "ANALYSIS_ERROR" && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
                <h3 className="text-base font-semibold text-foreground">
                  Couldn&apos;t analyze these products
                </h3>
                <p className="text-sm text-muted-foreground">
                  {errorMessage ??
                    "Product analysis is unavailable right now. Check your connection and try again."}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      analyzedForConfirmedRef.current = null;
                      void runAnalysis();
                    }}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Try Again
                  </button>
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <Camera className="size-4" aria-hidden="true" />
                    Retake
                  </button>
                </div>
              </div>
            )}
            {/* Phase 5: compare the whole shelf against the user's goal. */}
            {comparison && status === "PROFILES_READY" && (
              <ComparisonTable comparison={comparison} />
            )}
          </div>
        )}

        <ScanTips title="Scan Tips" items={MULTI_SCAN_TIPS} />
      </main>
    </div>
  );
}
