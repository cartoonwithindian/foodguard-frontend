"use client";

import { ScanBarcode, Search, Camera, ScanEye, LayoutGrid } from "lucide-react";

export type IdentifyMethod = "barcode" | "search" | "manual" | "visual_search" | "multi_scan";

type IdentifyLandingProps = {
  subtitle: string;
  scanBarcode: string;
  scanBarcodeDesc: string;
  searchName: string;
  searchNameDesc: string;
  addManually: string;
  addManuallyDesc: string;
  findSimilar: string;
  findSimilarDesc: string;
  multiScan: string;
  multiScanDesc: string;
  onSelect: (method: IdentifyMethod) => void;
};

export function IdentifyLanding({
  subtitle,
  scanBarcode,
  scanBarcodeDesc,
  searchName,
  searchNameDesc,
  addManually,
  addManuallyDesc,
  findSimilar,
  findSimilarDesc,
  multiScan,
  multiScanDesc,
  onSelect,
}: IdentifyLandingProps) {
  return (
    <div className="flex flex-col gap-5">
      <p className="mb-1 text-center text-sm text-muted-foreground">{subtitle}</p>

      <button
        type="button"
        onClick={() => onSelect("barcode")}
        className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <ScanBarcode className="size-6 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">{scanBarcode}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{scanBarcodeDesc}</p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelect("search")}
        className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Search className="size-6 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">{searchName}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{searchNameDesc}</p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelect("manual")}
        className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Camera className="size-6 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">{addManually}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{addManuallyDesc}</p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelect("multi_scan")}
        className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <LayoutGrid className="size-6 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">{multiScan}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{multiScanDesc}</p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelect("visual_search")}
        className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <ScanEye className="size-6 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">{findSimilar}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{findSimilarDesc}</p>
        </div>
      </button>
    </div>
  );
}