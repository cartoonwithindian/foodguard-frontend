"use client";

import {
  ScanBarcode,
  Search,
  Camera,
  ArrowUpRight,
  ScanEye,
  LayoutGrid,
} from "lucide-react";

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

const methods = [
  {
    id: "barcode" as const,
    titleKey: "scanBarcode" as const,
    descriptionKey: "scanBarcodeDesc" as const,
    Icon: ScanBarcode,
    accent: "bg-primary-light text-primary-dark",
  },
  {
    id: "search" as const,
    titleKey: "searchName" as const,
    descriptionKey: "searchNameDesc" as const,
    Icon: Search,
    accent: "bg-secondary text-primary",
  },
  {
    id: "manual" as const,
    titleKey: "addManually" as const,
    descriptionKey: "addManuallyDesc" as const,
    Icon: Camera,
    accent: "bg-primary/10 text-primary",
  },
  {
    id: "multi_scan" as const,
    titleKey: "multiScan" as const,
    descriptionKey: "multiScanDesc" as const,
    Icon: LayoutGrid,
    accent: "bg-primary/10 text-primary",
  },
  {
    id: "visual_search" as const,
    titleKey: "findSimilar" as const,
    descriptionKey: "findSimilarDesc" as const,
    Icon: ScanEye,
    accent: "bg-primary/10 text-primary",
  },
];

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
  const labels = {
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
  };

  return (
    <section>
      <div className="mb-7 text-center">
        <p className="foodguard-eyebrow text-primary">Identify a product</p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {methods.map(({ id, titleKey, descriptionKey, Icon, accent }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className="group foodguard-card flex min-h-48 flex-col items-start p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <div className={`flex size-12 items-center justify-center rounded-2xl ${accent}`}>
              <Icon className="size-6" aria-hidden="true" />
            </div>
            <h3 className="mt-5 text-base font-semibold text-foreground">{labels[titleKey]}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{labels[descriptionKey]}</p>
            <span className="mt-auto inline-flex items-center gap-1 pt-5 text-xs font-semibold text-primary">
              Continue
              <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
    </section>

  );
}
