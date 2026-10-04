"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, History, CheckCircle2, Building2, Tag, Barcode, RefreshCw, ArrowRight } from "lucide-react";
import Link from "next/link";

import { getScannerLabels } from "@/data/scanner-labels";
import {
  resolveProductByBarcode,
  buildAnalysisPath,
} from "@/lib/resolve-product";
import type { ExtractedInfo, IdentifiedProduct, ProductResolution } from "@/types/identification";
import { IdentifyLanding, type IdentifyMethod } from "./IdentifyLanding";
import { MultiProductScanner } from "./multi/MultiProductScanner";
import { BarcodeScanner } from "./BarcodeScanner";import { NameSearchForm } from "./NameSearchForm";
import { ManualAddPanel } from "./ManualAddPanel";
import { VisualSearchPanel } from "./VisualSearchPanel";
import { CandidatesList } from "./CandidatesList";
import { ScanLoading } from "./ScanLoading";
import { ScanError } from "./ScanError";
import { ScanTips } from "./ScanTips";
import { ProductNotFound } from "./ProductNotFound";
import { OfflineIndicator } from "@/components/offline/OfflineIndicator";

const RESOLUTION_SOURCE_LABELS: Record<string, string> = {
  local_cache: "From saved data",
  local_database: "From offline catalog",
  network: "From FoodGuard",
  fallback: "From saved data",
};

type ScannerPageProps = {
  lang?: string;
  /** Initial deep-link screen, e.g. "barcode" when coming from the dashboard. */
  initialScreen?: Screen;
};

type Screen = "identify" | IdentifyMethod;

const CATEGORY_FALLBACK: Record<string, string> = {
  food: "Food",
  beverage: "Beverage",
  cosmetics: "Cosmetics & Skincare",
  personal_care: "Personal Care",
  household: "Household",
  healthcare: "Healthcare",
  other: "Other",
};

export function ScannerPage({ lang = "en", initialScreen = "identify" }: ScannerPageProps) {
  const labels = getScannerLabels(lang);
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [loading, setLoading] = useState(false);
  const [resolution, setResolution] = useState<ProductResolution | null>(null);
  const [extracted, setExtracted] = useState<ExtractedInfo | null>(null);

  const handleResult = useCallback(
    (res: ProductResolution, extra?: ExtractedInfo) => {
      setResolution(res);
      setExtracted(extra ?? null);
      setLoading(false);
    },
    [],
  );

  const identifyByBarcode = useCallback(
    async (barcode: string, source: "barcode" | "manual_barcode") => {
      setLoading(true);
      setResolution(null);
      const res = await resolveProductByBarcode(barcode, source);
      handleResult(res, { barcode });
    },
    [handleResult],
  );

  const goTo = useCallback((next: Screen) => {
    setResolution(null);
    setExtracted(null);
    setLoading(false);
    setScreen(next);
  }, []);

  const goBack = useCallback(() => {
    if (resolution) {
      setResolution(null);
      setExtracted(null);
      return;
    }
    if (screen === "identify") {
      router.push("/");
    } else {
      setScreen("identify");
    }
  }, [resolution, screen, router]);

  const openAnalysis = useCallback(
    (product: IdentifiedProduct, extra?: ExtractedInfo | null) => {
      router.push(buildAnalysisPath(product, extra ?? undefined));
    },
    [router],
  );

  const screenTitle = useMemo(() => {
    if (resolution) return labels.header.title;
    switch (screen) {
      case "barcode":
        return labels.tabs.barcode;
      case "multi_scan":
        return labels.identify.multiScan;
      case "search":
        return labels.identify.searchName;
      case "manual":
        return labels.identify.addManually;
      case "visual_search":
        return labels.identify.findSimilar;
      default:
        return labels.header.title;
    }
  }, [resolution, screen, labels]);

  const renderResolution = () => {
    if (loading) {
      return <ScanLoading message={labels.loading.identifying} />;
    }
    if (!resolution) return null;

    switch (resolution.status) {
      case "resolved": {
        const product = resolution.product;
        return (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-5 rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm dark:border-green-900/50 dark:bg-green-950/40">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/50">
                  <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" aria-hidden="true" />
                </div>
                <h3 className="pt-2 text-base font-semibold text-green-800 dark:text-green-300">
                  {labels.barcode.productFound.title}
                </h3>
              </div>
              <div className="rounded-xl border border-green-200 bg-background p-4">
                <h4 className="text-lg font-semibold text-foreground">{product.name}</h4>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {product.brand && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="size-3.5" aria-hidden="true" />
                      {product.brand}
                    </span>
                  )}
                  {product.category && (
                    <span className="inline-flex items-center gap-1">
                      <Tag className="size-3.5" aria-hidden="true" />
                      {CATEGORY_FALLBACK[product.category] ?? product.category}
                    </span>
                  )}
                  {product.barcode && (
                    <span className="inline-flex items-center gap-1">
                      <Barcode className="size-3.5" aria-hidden="true" />
                      {product.barcode}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                    Source: {product.source}
                  </span>
                  {product.resolutionSource && (
                    <span className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                      {RESOLUTION_SOURCE_LABELS[product.resolutionSource] ?? product.resolutionSource}
                    </span>
                  )}
                  <span className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                    Confidence: {Math.round(product.confidence * 100)}%
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => openAnalysis(product, resolution.extracted ?? extracted)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {labels.barcode.productFound.analyzeButton}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => goBack()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  {labels.barcode.productFound.scanAgain}
                </button>
              </div>
            </div>
            <ScanTips title={labels.tips.title} items={labels.tips.items} />
          </div>
        );
      }

      case "candidates": {
        return (
          <div className="flex flex-col gap-5">
            <CandidatesList
              title={labels.identify.candidates.title}
              candidates={resolution.candidates}
              pickLabel={labels.identify.candidates.pick}
              onPick={(product) => openAnalysis(product, resolution.extracted ?? extracted)}
            />
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              {labels.identify.candidates.searchAgain}
            </button>
            <ScanTips title={labels.tips.title} items={labels.tips.items} />
          </div>
        );
      }

      case "not_found": {
        return (
          <div className="flex flex-col gap-5">
            <ProductNotFound
              title={labels.barcode.notFound.title}
              description={labels.barcode.notFound.description}
              scanIngredientLabel={labels.barcode.notFound.scanIngredient}
              enterManuallyLabel={labels.barcode.notFound.enterManually}
              tryAnotherLabel={labels.barcode.notFound.tryAnother}
              onScanIngredient={() => {
                goTo("manual");
              }}
              onEnterManually={() => goTo("manual")}
              onTryAnother={goBack}
            />
            <ScanTips title={labels.tips.title} items={labels.tips.items} />
          </div>
        );
      }

      case "error": {
        return (
          <div className="flex flex-col gap-5">
            <ScanError
              title={labels.error.title}
              description={resolution.message}
              tryAgainLabel={labels.error.tryAgain}
              enterManuallyLabel={labels.error.enterManually}
              onTryAgain={goBack}
              onEnterManually={() => goTo("manual")}
            />
            <ScanTips title={labels.tips.title} items={labels.tips.items} />
          </div>
        );
      }

      default:
        return null;
    }
  };

  const renderScreen = () => {
    if (loading || resolution) return renderResolution();

    switch (screen) {
      case "identify":
        return (
          <div className="flex flex-col gap-5">
            <IdentifyLanding
              subtitle={labels.identify.subtitle}
              scanBarcode={labels.identify.scanBarcode}
              scanBarcodeDesc={labels.identify.scanBarcodeDesc}
              searchName={labels.identify.searchName}
              searchNameDesc={labels.identify.searchNameDesc}
              addManually={labels.identify.addManually}
              addManuallyDesc={labels.identify.addManuallyDesc}
              findSimilar={labels.identify.findSimilar}
              findSimilarDesc={labels.identify.findSimilarDesc}
              multiScan={labels.identify.multiScan}
              multiScanDesc={labels.identify.multiScanDesc}
              onSelect={(method) => goTo(method)}
            />
            <ScanTips title={labels.tips.title} items={labels.tips.items} />
          </div>
        );

      case "barcode":
        return (
          <BarcodeScanner
            alignText={labels.barcode.viewport.alignBarcode}
            scanningText={labels.barcode.viewport.scanningForProduct}
            simulateLabel={labels.barcode.viewport.simulateScan}
            manualLabel={labels.barcode.manual.title}
            manualPlaceholder={labels.barcode.manual.inputPlaceholder}
            searchLabel={labels.barcode.manual.searchButton}
            isScanning={false}
            onSimulateScan={() => {}}
            onManualSearch={(barcode) => void identifyByBarcode(barcode, "manual_barcode")}
            onBarcodeFound={(barcode) => void identifyByBarcode(barcode, "barcode")}
          />
        );

      case "search":
        return (
          <NameSearchForm
            title={labels.identify.nameSearch.title}
            placeholder={labels.identify.nameSearch.placeholder}
            searchButton={labels.identify.nameSearch.searchButton}
            searching={labels.identify.nameSearch.searching}
            onResult={(res) => handleResult(res)}
          />
        );

      case "manual":
        return (
          <ManualAddPanel
            title={labels.identify.manual.title}
            takePhoto={labels.identify.manual.takePhoto}
            uploadImage={labels.identify.manual.uploadImage}
            processing={labels.identify.manual.processing}
            cancel={labels.identify.manual.cancel}
            barcodeTitle={labels.identify.manual.barcodeTitle}
            barcodePlaceholder={labels.identify.manual.barcodePlaceholder}
            barcodeButton={labels.identify.manual.barcodeButton}
            onResult={(res, extra) => handleResult(res, extra)}
          />
        );

      case "visual_search":
        return (
          <VisualSearchPanel
            onPick={(product) =>
              openAnalysis(
                {
                  id: product.id || product.name,
                  name: product.name,
                  brand: "",
                  category: "other",
                  source: "visual_search",
                  confidence: 0.8,
                  barcode: product.barcode ?? "",
                },
                extracted,
              )
            }
          />
        );

      default:
        return null;
    }
  };

  // Multi-product scanner is a standalone full-page experience with its
  // own header — render it without the single-product chrome. Its Back
  // button returns to /scan, which remounts this page on "identify".
  if (screen === "multi_scan" && !loading && !resolution) {
    return <MultiProductScanner />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {screen !== "identify" && !loading && !resolution
              ? labels.identify.backButton
              : labels.header.backButton}
          </button>
          <h1 className="text-sm font-semibold text-foreground">{screenTitle}</h1>
          <div className="flex items-center gap-2">
            <OfflineIndicator />
            <Link
              href="/history"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <History className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{labels.header.historyButton}</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{renderScreen()}</main>
    </div>
  );
}