"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Barcode,
  Camera,
  ImagePlus,
  Link2,
  Loader2,
  RefreshCw,
  ScanLine,
  X,
} from "lucide-react";

import type { DashboardLabels } from "@/data/dashboard-labels";
import { ScannerViewport } from "@/components/scanner/ScannerViewport";
import { CandidatesList } from "@/components/scanner/CandidatesList";
import {
  resolveProductByBarcode,
  resolveProductByPhotoLocalFirst,
  resolveProductByImageUrl,
  buildAnalysisPath,
} from "@/lib/resolve-product";
import { validateImageFile } from "@/lib/image/validation";
import type {
  ExtractedInfo,
  IdentifiedProduct,
  ProductResolution,
} from "@/types/identification";
import { createScanEventId } from "@/services/gamification.service";

type ScanHeroCardProps = {
  labels: DashboardLabels["scan"];
};

const HERO_COPY = {
  promptTitle: "Upload an image or use your camera",
  promptSubtitle:
    "We'll identify the product before showing food safety insights.",
  upload: "Upload Image",
  barcodeTitle: "Enter Barcode Manually",
  barcodePlaceholder: "Enter barcode number",
  barcodeButton: "Find Product",
  errorPhoto:
    "We couldn't read this photo. Try a clearer, well-lit image of the packaging.",
  errorCamera: "We couldn't read this photo. Please try again.",
  errorBarcode:
    "We couldn't search for that barcode right now. Please try again.",
  errorInput: "Please enter a barcode number.",
  linkTitle: "Search by image link",
  linkPlaceholder: "Paste a direct link to a product image",
  linkButton: "Find Similar",
  linkEmpty: "Please enter an image link.",
  linkButtonLabel: "Use an image link instead",
  similarTitle: "Similar products we found",
  similarHint:
    "We couldn't read the label, so we matched your photo against our product library. Pick one to analyse.",
};

type PanelMode = "closed" | "camera" | "barcode" | "link";

export function ScanHeroCard({ labels }: ScanHeroCardProps) {
  const router = useRouter();
  const [mode, setMode] = useState<PanelMode>("closed");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [imageLink, setImageLink] = useState("");
  const [candidates, setCandidates] = useState<IdentifiedProduct[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extractedRef = useRef<ExtractedInfo | null>(null);

  const openAnalysis = useCallback(
    (product: IdentifiedProduct, extracted: ExtractedInfo) => {
      router.push(buildAnalysisPath(product, extracted, undefined, createScanEventId()));
    },
    [router],
  );

  const handleResolution = useCallback(
    (resolution: ProductResolution, extracted: ExtractedInfo) => {
      switch (resolution.status) {
        case "resolved":
          openAnalysis(resolution.product, extracted);
          return;
        case "candidates":
          // Show the matches here. Pushing to /scan discarded them entirely:
          // ScannerPage keeps its own candidate state and re-runs its own scan.
          extractedRef.current = resolution.extracted ?? extracted;
          setCandidates(resolution.candidates);
          return;
        case "not_found": {
          const text =
            resolution.extracted?.ocrText ?? extracted.ingredientsText ?? "";
          if (!resolution.barcode && !text.trim()) {
            setErrorMsg(HERO_COPY.errorPhoto);
            return;
          }
          const params = new URLSearchParams();
          if (resolution.barcode) params.set("barcode", resolution.barcode);
          if (text) params.set("ocrText", text);
          const qs = params.toString();
          router.push(qs ? `/analysis?${qs}` : "/analysis");
          return;
        }
        case "error":
          setErrorMsg(resolution.message ?? HERO_COPY.errorPhoto);
          return;
      }
    },
    [openAnalysis, router],
  );

  const processImage = useCallback(
    async (file: Blob) => {
      setErrorMsg(null);
      setCandidates([]);
      setIsProcessing(true);
      setStatusText(labels.subtitle);
      try {
        const { resolution, extracted } = await resolveProductByPhotoLocalFirst(
          file,
          (status) => setStatusText(status),
        );
        handleResolution(resolution, extracted);
      } catch {
        setErrorMsg(HERO_COPY.errorPhoto);
      } finally {
        setIsProcessing(false);
        setStatusText("");
      }
    },
    [labels.subtitle, handleResolution],
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrorMsg(validation.error ?? HERO_COPY.errorPhoto);
      return;
    }
    void processImage(file);
  };

  const handleCapture = useCallback(
    (dataUrl: string) => {
      fetch(dataUrl)
        .then((res) => res.blob())
        .then((blob) => processImage(blob))
        .catch(() => setErrorMsg(HERO_COPY.errorCamera));
    },
    [processImage],
  );

  const submitImageLink = useCallback(
    async (value: string) => {
      const url = value.trim();
      if (!url) {
        setErrorMsg(HERO_COPY.linkEmpty);
        return;
      }
      setErrorMsg(null);
      setCandidates([]);
      setIsProcessing(true);
      setStatusText(HERO_COPY.similarTitle);
      try {
        const resolution = await resolveProductByImageUrl(url);
        handleResolution(resolution, { imageUrl: url });
      } catch {
        setErrorMsg(HERO_COPY.linkEmpty);
      } finally {
        setIsProcessing(false);
        setStatusText("");
      }
    },
    [handleResolution],
  );

  const submitBarcode = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value) {
        setErrorMsg(HERO_COPY.errorInput);
        return;
      }
      setErrorMsg(null);
      setIsProcessing(true);
      setStatusText(labels.subtitle);
      try {
        const resolution = await resolveProductByBarcode(value, "barcode");
        handleResolution(resolution, { barcode: value });
      } catch {
        setErrorMsg(HERO_COPY.errorBarcode);
      } finally {
        setIsProcessing(false);
        setStatusText("");
      }
    },
    [labels.subtitle, handleResolution],
  );

  const busy = isProcessing;

  return (
    <section className="foodguard-card flex h-full min-w-0 flex-col p-4 sm:p-6 lg:p-8">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="foodguard-eyebrow text-primary">Primary action</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground text-balance">
            {labels.title}
          </h2>
          <p className="mt-2 max-w-lg text-pretty text-sm leading-6 text-muted-foreground">
            {labels.subtitle}
          </p>
        </div>
        <div className="hidden size-12 items-center justify-center rounded-2xl bg-primary-light text-primary sm:flex">
          <ScanLine className="size-6" aria-hidden="true" />
        </div>
      </div>

      {errorMsg && (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary-light/40 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {HERO_COPY.similarTitle}
            </p>
            <p className="mt-1 text-pretty text-xs text-muted-foreground">
              {HERO_COPY.similarHint}
            </p>
          </div>
          <CandidatesList
            title=""
            candidates={candidates}
            pickLabel={labels.scanButton}
            onPick={(product) =>
              openAnalysis(product, extractedRef.current ?? { ocrText: "" })
            }
          />
          <button
            type="button"
            onClick={() => setCandidates([])}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {HERO_COPY.upload}
          </button>
        </div>
      )}

      {/* Collapsed prompt — click to expand the scanner panel. */}
      {mode === "closed" && candidates.length === 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setErrorMsg(null);
            setMode("camera");
          }}
          className="group mt-5 flex min-h-44 w-full min-w-0 flex-col items-center justify-center gap-y-1 rounded-2xl border-2 border-dashed border-primary/35 bg-secondary/65 px-4 py-8 text-center transition-colors hover:border-primary/60 hover:bg-primary-light/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-7 sm:min-h-48 sm:px-5 sm:py-10"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            <ImagePlus className="size-5" aria-hidden="true" />
          </span>
          <span className="mt-3 max-w-[min(100%,26rem)] text-pretty text-sm font-semibold text-foreground">
            {HERO_COPY.promptTitle}
          </span>
          <span className="max-w-[min(100%,26rem)] text-pretty text-xs text-muted-foreground">
            {HERO_COPY.promptSubtitle}
          </span>
          <span className="mt-3 inline-flex max-w-full items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground shadow-sm transition-colors group-hover:bg-primary-hover sm:mt-4">
            <Camera className="size-4" aria-hidden="true" />
            {labels.scanButton}
          </span>
        </button>
      )}

      {/* Expanded scanner panel — live camera capture. */}
      {mode === "camera" && (
        <div className="mt-7 flex flex-col gap-4">
          {busy && (
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
              <span>{statusText || labels.subtitle}</span>
            </div>
          )}

          <ScannerViewport
            alignText={labels.title}
            scanningText={statusText || labels.subtitle}
            isScanning={busy}
            showCamera={!busy}
            onCapture={handleCapture}
            captureLabel={labels.scanButton}
          />

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setErrorMsg(null);
                setImageLink("");
                setMode("link");
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Link2 className="size-4" aria-hidden="true" />
              {HERO_COPY.linkButtonLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ImagePlus className="size-4" aria-hidden="true" />
              {HERO_COPY.upload}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setErrorMsg(null);
                setBarcode("");
                setMode("barcode");
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Barcode className="size-4" aria-hidden="true" />
              {HERO_COPY.barcodeTitle}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode("closed")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-muted px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Expanded scanner panel — manual barcode entry. */}
      {mode === "link" && (
        <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          {busy && (
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
              <span>{statusText || labels.subtitle}</span>
            </div>
          )}

          <h3 className="text-base font-semibold text-foreground">
            {HERO_COPY.linkTitle}
          </h3>
          <p className="text-pretty text-xs text-muted-foreground">
            {HERO_COPY.similarHint}
          </p>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void submitImageLink(imageLink);
            }}
          >
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={imageLink}
              onChange={(event) => setImageLink(event.target.value)}
              placeholder={HERO_COPY.linkPlaceholder}
              disabled={busy}
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {HERO_COPY.linkButton}
            </button>
          </form>

          <button
            type="button"
            disabled={busy}
            onClick={() => setMode("camera")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Camera className="size-4" aria-hidden="true" />
            {labels.scanButton}
          </button>
        </div>
      )}

      {mode === "barcode" && (
        <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          {busy && (
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
              <span>{statusText || labels.subtitle}</span>
            </div>
          )}

          <h3 className="text-base font-semibold text-foreground">
            {HERO_COPY.barcodeTitle}
          </h3>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void submitBarcode(barcode);
            }}
          >
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              placeholder={HERO_COPY.barcodePlaceholder}
              disabled={busy}
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {HERO_COPY.barcodeButton}
            </button>
          </form>

          <button
            type="button"
            disabled={busy}
            onClick={() => setMode("camera")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Camera className="size-4" aria-hidden="true" />
            {labels.scanButton}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => setMode("closed")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-muted px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
