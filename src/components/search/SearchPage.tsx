"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import type { SearchProduct, UserCriteria } from "@/data/search-data";
import { findAlternatives, SEARCH_SUGGESTIONS } from "@/data/search-data";
import { getSearchLabels } from "@/data/search-labels";
import {
  searchCatalogProducts,
  normalizeSearchQuery,
  dedupeCatalogProducts,
  enrichCatalogImages,
} from "@/lib/search/search-service";
import type { CatalogProductItem } from "@/lib/store/sqlite";
import { useNetworkQuality } from "@/lib/network/use-network";
import { IngredientInput } from "./IngredientInput";
import { SearchSuggestions } from "./SearchSuggestions";
import { SearchResultCard } from "./SearchResultCard";
import { SortSelector } from "./SortSelector";
import { RecentSearches } from "./RecentSearches";
import { EmptySearchState } from "./EmptySearchState";
import { SearchLoading } from "./SearchLoading";
import { CriteriaSelector } from "./CriteriaSelector";
import { AlternativeSection } from "./AlternativeSection";
import { CompareView } from "./CompareView";
import { ProductCard } from "@/components/catalog/ProductCard";
import { cn } from "@/lib/utils";

type SearchPhase =
  | "idle"
  | "loading"
  | "results"
  | "empty"
  | "alternatives"
  | "compare";

type SearchPageProps = {
  lang?: string;
  initialQuery?: string;
};

const PAGE_SIZE = 24;

export function SearchPage({ lang = "en", initialQuery = "" }: SearchPageProps) {
  const labels = getSearchLabels(lang);
  const router = useRouter();
  const network = useNetworkQuality();
  const isOffline = network === "offline";

  const initialTerm = normalizeSearchQuery(initialQuery);

  const [phase, setPhase] = useState<SearchPhase>(() =>
    initialTerm ? "loading" : "idle",
  );
  const [showSuggestions, setShowSuggestions] = useState(!initialTerm);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    initialTerm ? [initialTerm] : [],
  );
  const [activeQuery, setActiveQuery] = useState(initialTerm);
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("new");
  const [results, setResults] = useState<CatalogProductItem[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<
    Array<{ key: string; label: string; count: number }>
  >([]);
  const [fromCache, setFromCache] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [alternativeResults, setAlternativeResults] = useState<SearchProduct[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const controllerRef = useRef<AbortController | null>(null);
  const initialHandledRef = useRef(false);

  const runSearch = useCallback(
    async (
      term: string,
      cat: string,
      sort: string,
      opts: { page?: number; append?: boolean } = {},
    ) => {
      const nextPage = opts.page ?? 1;
      const append = opts.append ?? false;
      const controller = new AbortController();
      controllerRef.current?.abort();
      controllerRef.current = controller;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoadingMore(false);
        setPhase("loading");
      }

      try {
        const result = await searchCatalogProducts({
          query: term,
          category: cat,
          sort,
          limit: PAGE_SIZE,
          page: nextPage,
          signal: controller.signal,
        });
        if (controllerRef.current !== controller) return;
        const enriched = await enrichCatalogImages(result.products);
        setPage(result.page);
        setHasMore(result.hasMore);
        setResults((prev) =>
          append
            ? dedupeCatalogProducts([...prev, ...enriched])
            : dedupeCatalogProducts(enriched),
        );
        setTotal(result.total);
        if (result.categories.length > 0) setCategories(result.categories);
        setFromCache(result.fromCache);
        if (!append) {
          setPhase(result.products.length > 0 ? "results" : "empty");
        }
      } catch {
        if (controllerRef.current !== controller) return;
        if (!append) {
          setResults([]);
          setTotal(0);
          setFromCache(false);
          setHasMore(false);
          setPhase("empty");
        }
      } finally {
        if (controllerRef.current === controller) setLoadingMore(false);
      }
    },
    [],
  );

  function loadMore() {
    if (loadingMore) return;
    void runSearch(activeQuery, category, sortBy, {
      page: page + 1,
      append: true,
    });
  }

  const fetchCategories = useCallback(async () => {
    try {
      const result = await searchCatalogProducts({
        query: "",
        category: "all",
        sort: "new",
        limit: 12,
      });
      if (result.categories.length > 0) setCategories(result.categories);
    } catch {
      /* non-fatal: category browse stays empty */
    }
  }, []);

  // Initial deep-link query.
  useEffect(() => {
    if (initialHandledRef.current) return;
    initialHandledRef.current = true;
    if (!initialTerm) {
      const timer = setTimeout(() => void fetchCategories(), 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => void runSearch(initialTerm, "all", "new"), 0);
    return () => clearTimeout(timer);
    
  }, []);

  // Refresh categories for the idle browse section once.
  useEffect(() => {
    if (phase === "idle" && categories.length === 0) {
      const timer = setTimeout(() => void fetchCategories(), 0);
      return () => clearTimeout(timer);
    }
    
  }, [phase]);

  function doSearch(searchQuery: string) {
    const trimmed = normalizeSearchQuery(searchQuery);
    if (!trimmed) return;
    setShowSuggestions(false);
    setActiveQuery(trimmed);
    setCategory("all");
    setRecentSearches((prev) =>
      [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, 5),
    );
    void runSearch(trimmed, "all", sortBy);
  }

  function selectCategory(categoryKey: string) {
    setShowSuggestions(false);
    setCategory(categoryKey);
    setPhase("loading");
    void runSearch(activeQuery, categoryKey, sortBy);
  }

  function handleSortChange(newSort: string) {
    setSortBy(newSort);
    setPhase("loading");
    void runSearch(activeQuery, category, newSort);
  }

  function handleSelectProduct(barcode: string) {
    router.push(`/analysis?barcode=${encodeURIComponent(barcode)}`);
  }

  function handleClearRecent() {
    setRecentSearches([]);
  }

  function handleCompareToggle(id: string) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }

  function handleCompare() {
    if (compareIds.length >= 2) setPhase("compare");
  }

  function handleCriteriaFind(criteria: UserCriteria) {
    setPhase("loading");
    setTimeout(() => {
      const found = findAlternatives(criteria);
      setAlternativeResults(found);
      setPhase(found.length > 0 ? "alternatives" : "empty");
    }, 500);
  }

  function handleBackFromCompare() {
    setPhase(alternativeResults.length > 0 ? "alternatives" : "idle");
  }

  function handleEmptyReset() {
    setPhase("idle");
    setShowSuggestions(true);
    setActiveQuery("");
    setCategory("all");
    setResults([]);
    setTotal(0);
    setPage(1);
    setHasMore(false);
    setLoadingMore(false);
  }

  const sortOptions = [
    { value: "new", label: labels.results.sortNewest },
    { value: "name_asc", label: labels.results.sortNameAsc },
    { value: "name_desc", label: labels.results.sortNameDesc },
    { value: "rating", label: labels.results.sortRating },
    { value: "brand", label: labels.results.sortBrand },
  ];

  const compareProducts = alternativeResults.filter((p) =>
    compareIds.includes(p.id),
  );

  if (phase === "compare") {
    return (
      <CompareView
        products={compareProducts.length >= 2 ? compareProducts : []}
        labels={labels.comparison}
        onBack={handleBackFromCompare}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {labels.header.backButton}
          </Link>
          <h1 className="ml-4 text-base font-semibold text-foreground">
            {labels.header.title}
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {/* Search Input */}
        <div className="mb-2">
          <IngredientInput
            placeholder={labels.search.placeholder}
            searchButton={labels.search.searchButton}
            inputTypeLabels={labels.inputType}
            onSearch={doSearch}
          />
        </div>
        <p className="mb-6 text-center text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {labels.header.subtitle}
        </p>

        {/* Idle: suggestions + criteria + browse categories */}
        {phase === "idle" && showSuggestions && (
          <div className="space-y-6">
            {recentSearches.length > 0 && (
              <RecentSearches
                title={labels.recent.title}
                clearLabel={labels.recent.clearButton}
                searches={recentSearches}
                onSelect={(s) => {
                  doSearch(s);
                }}
                onClear={handleClearRecent}
              />
            )}
            <SearchSuggestions
              title={labels.suggestions.title}
              suggestions={labels.suggestions.items}
              onSelect={(s) => {
                doSearch(s);
              }}
            />
            <CriteriaSelector
              title={labels.criteria.title}
              subtitle={labels.criteria.subtitle}
              findButton={labels.criteria.findButton}
              avoidPlaceholder={labels.criteria.avoidPlaceholder}
              preferPlaceholder={labels.criteria.preferPlaceholder}
              customPlaceholder={labels.criteria.customPlaceholder}
              onFind={handleCriteriaFind}
            />

            {categories.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {labels.initial.categoryTitle}
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {categories.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => selectCategory(c.key)}
                      className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:border-primary/30"
                    >
                      {c.label}
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {c.count.toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {phase === "loading" && <SearchLoading message={labels.loading.message} />}

        {/* Results / Empty */}
        {(phase === "results" || phase === "empty") && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {activeQuery
                    ? `${labels.results.title} “${activeQuery}”`
                    : labels.results.title}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {labels.results.count.replace("{count}", String(total))}
                </p>
              </div>
              <SortSelector
                label={labels.results.sortBy}
                options={sortOptions}
                value={sortBy}
                onChange={handleSortChange}
              />
            </div>

            {fromCache && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                {labels.results.fromCache}
              </div>
            )}

            {isOffline && (
              <div className="rounded-xl border border-muted bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
                {labels.results.offlineBanner}
              </div>
            )}

            {/* Browse-category chips from the real FoodGuard catalog */}
            {categories.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => selectCategory("all")}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                    category === "all"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {labels.categories.all}
                </button>
                {categories.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => selectCategory(c.key)}
                    className={cn(
                      "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                      category === c.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    )}
                  >
                    {c.label} ({c.count.toLocaleString()})
                  </button>
                ))}
              </div>
            )}

            {phase === "empty" ? (
              <EmptySearchState
                title={labels.empty.title}
                description={labels.empty.description}
                clearFiltersLabel={labels.empty.clearFilters}
                searchAgainLabel={labels.empty.searchAgain}
                tryNameLabel={labels.empty.tryName}
                scanBarcodeLabel={labels.empty.scan}
                onScan={() => router.push("/scan")}
                categoryTitle=""
                popularTitle=""
                categories={[]}
                popularSearches={[]}
                onClearFilters={handleEmptyReset}
                onSearchAgain={handleEmptyReset}
                onSelectCategory={() => {}}
                onSelectPopular={() => {}}
              />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {results.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      viewAnalysisLabel={labels.results.viewAnalysis}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          {labels.loading.message}
                        </>
                      ) : (
                        <>
                          {labels.results.loadMore}
                          <span className="text-muted-foreground">
                            ({Math.max(total - results.length, 0).toLocaleString()} remaining)
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}

            <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
              <Info className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {labels.transparency.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {labels.transparency.description}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Alternatives */}
        {phase === "alternatives" && (
          <div className="space-y-5">
            <AlternativeSection
              title={labels.alternatives.title}
              description={labels.alternatives.description}
              disclaimer={labels.alternatives.disclaimer}
            />

            {alternativeResults.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {alternativeResults.map((product) => (
                  <SearchResultCard
                    key={product.id}
                    product={product}
                    viewAnalysisLabel={labels.results.viewAnalysis}
                    compareLabel={labels.results.compare}
                    comparedLabel={labels.results.compared}
                    whyMatchDetailLabel={labels.results.whyMatchDetail}
                    matchLabels={{
                      matchLabel: labels.results.matchLabel,
                      whyMatch: labels.results.whyMatch,
                      matchedIngredients: labels.results.matchedIngredients,
                      missingIngredients: labels.results.missingIngredients,
                    }}
                    onSelect={handleSelectProduct}
                    onCompareToggle={handleCompareToggle}
                    isComparing={compareIds.includes(product.id)}
                    canCompare={compareIds.length < 4}
                  />
                ))}
              </div>
            ) : (
              <EmptySearchState
                title={labels.empty.title}
                description={labels.empty.description}
                clearFiltersLabel={labels.empty.clearFilters}
                searchAgainLabel={labels.empty.searchAgain}
                tryNameLabel={labels.empty.tryName}
                scanBarcodeLabel={labels.empty.scan}
                onScan={() => router.push("/scan")}
                categoryTitle=""
                popularTitle=""
                categories={[]}
                popularSearches={[]}
                onClearFilters={handleEmptyReset}
                onSearchAgain={handleEmptyReset}
                onSelectCategory={() => {}}
                onSelectPopular={() => {}}
              />
            )}

            {compareIds.length >= 2 && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleCompare}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {labels.comparison.compareButton} ({compareIds.length})
                </button>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
              <Info className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {labels.transparency.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {labels.transparency.description}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}