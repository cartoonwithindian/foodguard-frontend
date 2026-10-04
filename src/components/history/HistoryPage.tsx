"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Home, ScanLine, Search, Clock, User, Barcode } from "lucide-react";
import { getHistoryLabels } from "@/data/history-labels";
import { getAnalysisLabels } from "@/data/analysis-labels";
import {
  getHistoryItems,
  getHistoryCounts,
  searchHistory,
  type HistoryItem,
  type HistoryFilter,
} from "@/data/history-data";
import type { ProductCategory, AssessmentLevel } from "@/types/domain";
import type { ProductAnalysisResult } from "@/data/analysis-data";
import {
  normalizeSearchQuery,
  searchCatalogProducts,
} from "@/lib/search/search-service";
import { useAuth } from "@/components/AuthProvider";
import {
  firebaseListHistory,
  firebaseDeleteHistory,
  type FirebaseHistoryItem,
} from "@/lib/firebase/db";
import {
  TopNavigation,
  BottomNavigation,
} from "@/components/dashboard/Navigation";
import { HistorySummary } from "./HistorySummary";
import { CategoryTabs } from "./CategoryTabs";
import { HistorySearchBar } from "./HistorySearchBar";
import { HistoryFilters } from "./HistoryFilters";
import { HistoryProductCard } from "./HistoryProductCard";
import { DeleteConfirmation } from "./DeleteConfirmation";
import { EmptyHistoryState } from "./EmptyHistoryState";
import { HistoryDetailView } from "./HistoryDetailView";

type TabLevel = "all" | "high" | "moderate" | "low";

const NAV_ITEMS = [
  { key: "home", label: "Home", href: "/", Icon: Home },
  { key: "scan", label: "Scan", href: "/scan", Icon: ScanLine },
  { key: "search", label: "Search", href: "/search", Icon: Search },
  { key: "history", label: "History", href: "/history", Icon: Clock },
  { key: "benchmark", label: "Benchmark", href: "/benchmark", Icon: Barcode },
  { key: "profile", label: "Profile", href: "/profile", Icon: User },
];

const ASSESSMENTS: AssessmentLevel[] = ["low", "moderate", "high", "insufficient"];
const CATEGORIES: ProductCategory[] = [
  "food",
  "cosmetics",
  "personal_care",
  "household",
  "other",
];

const catalogImageLookupCache = new Map<string, Promise<string | null>>();

function findCatalogImage(item: HistoryItem): Promise<string | null> {
  const barcode = item.barcode.trim();
  const query = barcode || item.name;
  const cacheKey = normalizeSearchQuery(query);
  const cached = catalogImageLookupCache.get(cacheKey);
  if (cached) return cached;

  const lookup = searchCatalogProducts({ query, limit: 10 })
    .then(({ products }) => {
      const normalizedName = normalizeSearchQuery(item.name);
      const match = products.find((product) => barcode && product.barcode.trim() === barcode)
        ?? products.find((product) => normalizeSearchQuery(product.name) === normalizedName);
      return match?.imageUrl ?? null;
    })
    .catch(() => null);
  catalogImageLookupCache.set(cacheKey, lookup);
  return lookup;
}

function toHistoryItem(doc: FirebaseHistoryItem): HistoryItem {
  const assessment = ASSESSMENTS.includes(doc.assessment as AssessmentLevel)
    ? (doc.assessment as AssessmentLevel)
    : "moderate";
  const category = CATEGORIES.includes(doc.category as ProductCategory)
    ? (doc.category as ProductCategory)
    : "other";
  const analysis = doc.analysis as ProductAnalysisResult;
  const imageUrl = doc.imageUrl || analysis.imageUrl;
  return {
    id: doc.id,
    name: doc.name,
    brand: doc.brand ?? "",
    category,
    barcode: doc.barcode ?? "",
    scannedAt: new Date(doc.scannedAt).toISOString(),
    assessment,
    score: doc.score ?? 0,
    analysis: { ...analysis, imageUrl },
  };
}

export function HistoryPage({ lang = "en" }: { lang?: string }) {
  const router = useRouter();
  const labels = getHistoryLabels(lang);
  const analysisLabels = getAnalysisLabels(lang);
  const { firebaseMode, firebaseUser } = useAuth();
  const [activeNav, setActiveNav] = useState("history");

  const [items, setItems] = useState<HistoryItem[]>(() => getHistoryItems());
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabLevel>("all");
  const [filters, setFilters] = useState<HistoryFilter>({
    assessment: "all",
    category: "all",
    dateRange: "all",
  });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [detailProduct, setDetailProduct] = useState<HistoryItem | null>(null);

  useEffect(() => {
    if (!firebaseMode || !firebaseUser) return;
    let cancelled = false;
    void firebaseListHistory(firebaseUser.uid).then((docs) => {
      if (cancelled) return;
      setItems(docs.map(toHistoryItem));
    });
    return () => {
      cancelled = true;
    };
  }, [firebaseMode, firebaseUser]);

  const counts = getHistoryCounts(items);

  useEffect(() => {
    const missingImages = items.filter(
      (item) => !item.analysis.imageUrl && (item.barcode || item.name),
    );
    if (missingImages.length === 0) return;

    let cancelled = false;
    let nextIndex = 0;
    const imageUpdates = new Map<string, string>();

    async function lookupWorker() {
      while (!cancelled) {
        const item = missingImages[nextIndex++];
        if (!item) return;
        const imageUrl = await findCatalogImage(item);
        if (imageUrl) imageUpdates.set(item.id, imageUrl);
      }
    }

    async function applyCatalogImages() {
      const workerCount = Math.min(4, missingImages.length);
      await Promise.all(Array.from({ length: workerCount }, () => lookupWorker()));
      if (cancelled || imageUpdates.size === 0) return;

      setItems((current) => current.map((item) => {
        const imageUrl = imageUpdates.get(item.id);
        if (!imageUrl || item.analysis.imageUrl) return item;
        return { ...item, analysis: { ...item.analysis, imageUrl } };
      }));
    }

    void applyCatalogImages();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const filteredItems = searchHistory(items, query, {
    ...filters,
    assessment: activeTab !== "all" ? activeTab : filters.assessment,
  });

  const handleNav = useCallback(
    (key: string) => {
      setActiveNav(key);
      if (key === "home") router.push("/");
      else if (key === "scan") router.push("/scan");
      else if (key === "search") router.push("/search");
      else if (key === "profile") router.push("/profile");
    },
    [router],
  );

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
<div className="flex min-h-screen flex-col bg-background pb-nav-safe lg:pb-0">
      {/* TopNavigation no longer takes items/activeKey; it derives them itself. */}
      <TopNavigation />

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
          {items.length === 0 ? (
            <EmptyHistoryState
              labels={labels.empty}
              onScan={() => handleNav("scan")}
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

      <BottomNavigation
        items={NAV_ITEMS}
        activeKey={activeNav}
      />
    </div>
  );
}
