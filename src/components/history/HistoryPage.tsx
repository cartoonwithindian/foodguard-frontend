"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getHistoryLabels } from "@/data/history-labels";
import { getAnalysisLabels } from "@/data/analysis-labels";
import {
  getHistoryCounts,
  searchHistory,
  type HistoryItem,
  type HistoryFilter,
} from "@/data/history-data";
import type { ProductCategory, AssessmentLevel } from "@/types/domain";
import type { ProductAnalysisResult } from "@/data/analysis-data";
import { useAuth } from "@/components/AuthProvider";
import {
  firebaseListHistory,
  firebaseDeleteHistory,
  type FirebaseHistoryItem,
} from "@/lib/firebase/db";
import { apiUrl } from "@/lib/network/api-url";
import { ErrorState, LoadingState } from "@/components/ui/StateViews";
import { HistorySummary } from "./HistorySummary";
import { CategoryTabs } from "./CategoryTabs";
import { HistorySearchBar } from "./HistorySearchBar";
import { HistoryFilters } from "./HistoryFilters";
import { HistoryProductCard } from "./HistoryProductCard";
import { DeleteConfirmation } from "./DeleteConfirmation";
import { EmptyHistoryState } from "./EmptyHistoryState";
import { HistoryDetailView } from "./HistoryDetailView";

type TabLevel = "all" | "high" | "moderate" | "low";

const ASSESSMENTS: AssessmentLevel[] = ["low", "moderate", "high", "insufficient"];
const CATEGORIES: ProductCategory[] = [
  "food",
  "cosmetics",
  "personal_care",
  "household",
  "other",
];

function toHistoryItem(doc: FirebaseHistoryItem): HistoryItem {
  const assessment = ASSESSMENTS.includes(doc.assessment as AssessmentLevel)
    ? (doc.assessment as AssessmentLevel)
    : "moderate";
  const category = CATEGORIES.includes(doc.category as ProductCategory)
    ? (doc.category as ProductCategory)
    : "other";
  return {
    id: doc.id,
    name: doc.name,
    brand: doc.brand ?? "",
    category,
    barcode: doc.barcode ?? "",
    scannedAt: new Date(doc.scannedAt).toISOString(),
    assessment,
    score: doc.score ?? 0,
    analysis: doc.analysis as ProductAnalysisResult,
  };
}

type ApiHistoryEntry = {
  id: string;
  productId: string | null;
  name: string;
  brand?: string | null;
  category?: string | null;
  barcode?: string | null;
  scannedAt: string;
  assessment?: string | null;
  score?: number | null;
  source?: string | null;
  analysis?: ProductAnalysisResult | null;
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("foodgaurd-token");
  } catch {
    return null;
  }
}

/**
 * Map a real `/api/history` entry into the view model. The backend persists the
 * full analysis snapshot, so the detail view works exactly as in Firebase mode.
 */
function toHistoryItemFromApi(entry: ApiHistoryEntry): HistoryItem {
  const assessment = ASSESSMENTS.includes(entry.assessment as AssessmentLevel)
    ? (entry.assessment as AssessmentLevel)
    : "moderate";
  const category = CATEGORIES.includes(entry.category as ProductCategory)
    ? (entry.category as ProductCategory)
    : "other";
  return {
    id: entry.id,
    name: entry.name,
    brand: entry.brand ?? "",
    category,
    barcode: entry.barcode ?? "",
    scannedAt: new Date(entry.scannedAt).toISOString(),
    assessment,
    score: entry.score ?? 0,
    analysis: (entry.analysis ?? {
      id: entry.productId ?? entry.id,
      name: entry.name,
      brand: entry.brand ?? "",
      category,
      barcode: entry.barcode ?? "",
      scanDate: new Date(entry.scannedAt).toLocaleDateString(),
      assessment,
      assessmentDescription: "",
      score: entry.score ?? 0,
      positivePoints: [],
      attentionPoints: [],
      ingredients: [],
      alternativeSuggestions: [],
      evidenceSources: [],
    }) as ProductAnalysisResult,
  };
}

export function HistoryPage({ lang = "en" }: { lang?: string }) {
  const router = useRouter();
  const labels = getHistoryLabels(lang);
  const analysisLabels = getAnalysisLabels(lang);
  const { firebaseMode, firebaseUser, isLoading: authLoading } = useAuth();

  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabLevel>("all");
  const [filters, setFilters] = useState<HistoryFilter>({
    assessment: "all",
    category: "all",
    dateRange: "all",
  });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [detailProduct, setDetailProduct] = useState<HistoryItem | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (authLoading) return;

    // Firebase mode reads the user's Firestore history directly.
    if (firebaseMode) {
      if (!firebaseUser) {
        setItems([]);
        setLoadState("loaded");
        return;
      }
      setLoadState("loading");
      let cancelled = false;
      void firebaseListHistory(firebaseUser.uid)
        .then((docs) => {
          if (cancelled) return;
          setItems(docs.map(toHistoryItem));
          setLoadState("loaded");
        })
        .catch(() => {
          if (!cancelled) setLoadState("error");
        });
      return () => {
        cancelled = true;
      };
    }

    // JWT mode reads the real backend history endpoint.
    const token = getToken();
    if (!token) {
      setItems([]);
      setLoadState("loaded");
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoadState("loading");
    void (async () => {
      try {
        const response = await fetch(apiUrl("/api/history"), {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const json = (await response.json()) as {
          success: boolean;
          data?: { history: ApiHistoryEntry[] };
          error?: { message?: string } | null;
        };
        if (cancelled) return;
        if (!response.ok || !json.success || !json.data) {
          setLoadState("error");
          return;
        }
        setItems(json.data.history.map(toHistoryItemFromApi));
        setLoadState("loaded");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!cancelled) setLoadState("error");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [authLoading, firebaseMode, firebaseUser, retryCount]);

  const counts = getHistoryCounts(items);

  const filteredItems = searchHistory(items, query, {
    ...filters,
    assessment: activeTab !== "all" ? activeTab : filters.assessment,
  });

  const handleScan = useCallback(() => {
    router.push("/scan");
  }, [router]);

  const handleTabChange = useCallback((tab: TabLevel) => {
    setActiveTab(tab);
    setFilters((prev) => ({
      ...prev,
      assessment: tab !== "all" ? tab : "all",
    }));
  }, []);

  const handleFilterApply = useCallback((newFilters: HistoryFilter) => {
    setFilters(newFilters);
    if (newFilters.assessment !== "all" && newFilters.assessment !== "insufficient") {
      setActiveTab(newFilters.assessment);
    } else {
      setActiveTab("all");
    }
  }, []);

  const handleFilterClear = useCallback(() => {
    setFilters({ assessment: "all", category: "all", dateRange: "all" });
    setActiveTab("all");
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setDeleteTarget(null);
      if (firebaseMode && firebaseUser) {
        void firebaseDeleteHistory(firebaseUser.uid, id);
        return;
      }
      const token = getToken();
      if (token) {
        void fetch(apiUrl(`/api/history/${encodeURIComponent(id)}`), {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {
          // Best-effort remote delete; the row is already gone locally.
        });
      }
    },
    [firebaseMode, firebaseUser],
  );

  const handleViewAnalysis = useCallback((id: string) => {
    const found = items.find((i) => i.id === id);
    if (found) setDetailProduct(found);
  }, [items]);

  if (detailProduct) {
    return (
      <HistoryDetailView
        product={detailProduct.analysis}
        labels={labels}
        analysisLabels={{
          assessment: analysisLabels.assessment,
          positive: analysisLabels.positive,
          attention: analysisLabels.attention,
          ingredients: analysisLabels.ingredients,
          nutrition: analysisLabels.nutrition,
          evidence: analysisLabels.evidence,
          alternatives: analysisLabels.alternatives,
          disclaimer: analysisLabels.disclaimer,
        }}
        onBack={() => setDetailProduct(null)}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">
              {labels.header.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {labels.header.subtitle}
            </p>
          </div>

          {/* Summary */}
          <HistorySummary
            labels={labels.summary}
            counts={counts}
            onHighClick={() => handleTabChange("high")}
            onModerateClick={() => handleTabChange("moderate")}
            onLowClick={() => handleTabChange("low")}
          />

          {/* Recently scanned — top 5 */}
          {items.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                {labels.recentScans.title}
              </h2>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {items.slice(0, 5).map((item) => {
                  const concernLabel =
                    item.assessment === "high"
                      ? "High Concern"
                      : item.assessment === "moderate"
                        ? "Moderate"
                        : "Low Concern";
                  const formattedDate = new Date(item.scannedAt).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                  });
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleViewAnalysis(item.id)}
                      className="flex shrink-0 flex-col gap-1 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <p className="text-sm font-medium text-foreground line-clamp-1">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{formattedDate}</p>
                      <span className="text-xs font-medium text-primary">{concernLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search + Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <HistorySearchBar
                placeholder={labels.search.placeholder}
                value={query}
                onChange={setQuery}
                onSearch={() => {}}
              />
            </div>
            <HistoryFilters
              labels={labels.filters}
              filters={filters}
              onApply={handleFilterApply}
              onClear={handleFilterClear}
            />
          </div>

          {/* Tabs */}
          <CategoryTabs
            labels={labels.tabs}
            active={activeTab}
            onChange={handleTabChange}
          />

          {/* Product list */}
          {loadState === "loading" ? (
            <LoadingState label="Loading your history…" rows={4} />
          ) : loadState === "error" ? (
            <ErrorState
              title="Something went wrong"
              description="We couldn't load your scan history. Please try again."
              retryLabel="Try again"
              onRetry={() => setRetryCount((c) => c + 1)}
            />
          ) : items.length === 0 ? (
            <EmptyHistoryState
              labels={labels.empty}
              onScan={handleScan}
            />
          ) : filteredItems.length === 0 ? (
            <EmptyHistoryState
              labels={labels.empty}
              isFiltered
              filteredLabels={labels.emptyFiltered}
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredItems.map((item) => (
                <HistoryProductCard
                  key={item.id}
                  product={item}
                  labels={labels.productCard}
                  deleteLabels={labels.delete}
                  onViewAnalysis={handleViewAnalysis}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}

          {/* Results count */}
          {filteredItems.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              {filteredItems.length} product{filteredItems.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </main>

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteConfirmation
          labels={labels.delete}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
