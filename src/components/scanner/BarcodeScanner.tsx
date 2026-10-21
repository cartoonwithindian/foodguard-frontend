"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Camera, AlertCircle, RefreshCw } from "lucide-react";
import { ScannerViewport } from "./ScannerViewport";
import { ManualBarcodeInput } from "./ManualBarcodeInput";
import { validateImageFile } from "@/lib/image/validation";
import { decodeBarcodeFromImage, validateBarcode } from "@/lib/barcode/decoder";

type BarcodeScannerProps = {
  alignText: string;
  scanningText: string;
  simulateLabel: string;
  manualLabel: string;
  manualPlaceholder: string;
  searchLabel: string;
  isScanning: boolean;
  onSimulateScan: () => void;
  onManualSearch: (barcode: string) => void;
  onBarcodeFound?: (barcode: string) => void;
};

export function BarcodeScanner({
  alignText,
  scanningText,
  manualLabel,
  manualPlaceholder,
  searchLabel,
  isScanning,
  onManualSearch,
  onBarcodeFound,
}: BarcodeScannerProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [decodingFile, setDecodingFile] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photo search: opens the native scanner (camera -> photo -> visual-search
  // API -> similar products). Falls back to the file picker elsewhere, same
  // as VisualSearchPanel's native-scanner button.
  const openPhotoSearch = useCallback(() => {
    setErrorMsg(null);
    const bridge = (window as unknown as Record<string, unknown>)
      .FoodGuardBridge as { openVisualScanner?: () => void } | undefined;
    if (bridge?.openVisualScanner) {
      bridge.openVisualScanner();
    } else {
      fileInputRef.current?.click();
    }
  }, []);

  const handleBarcodeDetected = useCallback(
    (barcode: string) => {
      const clean = barcode.trim();
      if (validateBarcode(clean)) {
        if (onBarcodeFound) {
          onBarcodeFound(clean);
        } else {
          onManualSearch(clean);
        }
      }
    },
    [onBarcodeFound, onManualSearch]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrorMsg(validation.error || "Invalid file");
      e.target.value = "";
      return;
    }

    setDecodingFile(true);
    try {
      const decoded = await decodeBarcodeFromImage(file);
      if (decoded && decoded.value) {
        handleBarcodeDetected(decoded.value);
      } else {
        setErrorMsg(
          "Barcode could not be detected. Try a clearer image with the barcode centered and well lit."
        );
      }
    } catch {
      setErrorMsg(
        "Barcode could not be detected. Try a clearer image with the barcode centered and well lit."
      );
    } finally {
      setDecodingFile(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {errorMsg && (
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{errorMsg}</p>
          </div>
        </div>
      )}

      {showCamera ? (
        <div className="flex flex-col gap-3">
          <ScannerViewport
            alignText={alignText}
            scanningText={scanningText}
            isScanning={isScanning || decodingFile}
            showCamera={true}
            onBarcodeDetected={handleBarcodeDetected}
          />
          <button
            type="button"
            onClick={() => setShowCamera(false)}
            className="rounded-xl border border-border bg-background py-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Close Camera
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setShowCamera(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Camera className="size-4" aria-hidden="true" />
            Start Camera Scanner
          </button>

          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              fileInputRef.current?.click();
            }}
            disabled={decodingFile}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {decodingFile ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" aria-hidden="true" />
            )}
            {decodingFile ? "Scanning Barcode..." : "Upload Barcode Image"}
          </button>

          <button
            type="button"
            onClick={openPhotoSearch}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-5 py-3.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <Camera className="size-4" aria-hidden="true" />
            Take Photo and Search
          </button>
        </div>
      )}

      <div className="border-t border-border pt-5">
        <ManualBarcodeInput
          label={manualLabel}
          placeholder={manualPlaceholder}
          buttonLabel={searchLabel}
          onSubmit={onManualSearch}
        />
      </div>
    </div>
  );
}
