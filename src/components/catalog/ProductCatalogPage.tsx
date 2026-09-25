"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Inbox, Search, SlidersHorizontal, Loader2 } from "lucide-react";
import type { CatalogProductItem } from "@/lib/store/sqlite";
import { catalogCache } from "@/lib/cache/catalog-cache";
import { useNetworkQuality } from "@/lib/network/use-network";
import { OfflineIndicator } from "@/components/offline/OfflineIndicator";
import { ProductCard } from "./ProductCard";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/network/api-url";

export type CatalogParams = {
  search?: string;
  category?: string;
  sort?: string;
};

type CatalogApiResponse = {
  success: boolean;
  data?: {
    products: CatalogProductItem[];
    total: number;
    dbTotal: number;
    page: number;
    limit: number;
    hasMore: boolean;
    categories: Array<{ key: string; label: string; count: number }>;
  };
  error?: { message?: string } | null;
};

const PAGE_SIZE = 24;
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "new", label: "Newest" },
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
  { value: "rating", label: "Top rated" },
  { value: "brand", label: "Brand (A–Z)" },
];

type CatalogPhase = "loading" | "ready" | "error";

export function ProductCatalogPage({
  search: initialSearch = "",
  category: initialCategory = "all",
  sort: initialSort = "new",
}: CatalogParams) {
  const network = useNetworkQuality();
  const isOffline = network === "offline";

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState(initialSort);

  const [products, setProducts] = useState<CatalogProductItem[]>([]);
  const [categories, setCategories] = useState<Array<{ key: string; label: string; count: number }>>([]);
  const [total, setTotal] = useState(0);
  const [dbTotal, setDbTotal] = useState(0);
  const [phase, setPhase] = useState<CatalogPhase>("loading");
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");
  const [cachedEntry, setCachedEntry] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);
  const pageRef = useRef(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(
    async (
      pageNum: number,
      opts: { searchQ: string; cat: string; sortBy: string; append: boolean },
    ) => {
      const controller = new AbortController();
      controllerRef.current?.abort();
      controllerRef.current = controller;

      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(PAGE_SIZE),
        category: opts.cat,
        sort: opts.sortBy,
      });
      if (opts.searchQ) params.set("search", opts.searchQ);

      const tryCache = pageNum === 1;
      if (!opts.append) {
        await Promise.resolve();
        setPhase("loading");
        setProducts([]);
        setErrorMessage("");
      }
      if (tryCache) {
        const cached = await catalogCache().get(opts.searchQ, opts.cat, opts.sortBy);
        if (cached && cached.data.products.length > 0) {
          setProducts(cached.data.products);
          setTotal(cached.data.total);
          setDbTotal(cached.data.dbTotal);
          setCategories(cached.data.categories);
          setHasMore(cached.data.products.length < cached.data.total);
          setCachedEntry(true);
          setPhase("ready");
        }
      }

      try {
        const response = await fetch(apiUrl(`/api/products?${params.toString()}`), {
          signal: controller.signal,
        });
        const json = (await response.json()) as CatalogApiResponse;
        if (!response.ok || !json.success || !json.data) {
          throw new Error(json.error?.message ?? "Catalog request failed");
        }
        const data = json.data;
        setProducts((prev) => (opts.append ? [...prev, ...data.products] : data.products));
        setTotal(data.total);
        setDbTotal(data.dbTotal);
        setCategories(data.categories);
        setPage(pageNum);
        pageRef.current = pageNum;
        setHasMore(data.hasMore);
        setCachedEntry(false);
        setPhase("ready");
        setErrorMessage("");
        if (pageNum === 1) {
          void catalogCache().save(opts.searchQ, opts.cat, opts.sortBy, {
            products: data.products,
            total: data.total,
            dbTotal: data.dbTotal,
            categories: data.categories,
            fetchedAt: Date.now(),
          });
        }
} catch (error) {
        if (controller.signal.aborted) return;
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Something went wrong");
      }
    },
    [],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // Wait for debounce to settle before fetching.
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPage(1, { searchQ: search, cat: category, sortBy: sort, append: false });
    }, 0);
    return () => {
      clearTimeout(timer);
      controllerRef.current?.abort();
    };

  }, [search, category, sort]);

  const loadMore = useCallback(() => {
    const next = pageRef.current + 1;
    void fetchPage(next, { searchQ: search, cat: category, sortBy: sort, append: true });
  }, [fetchPage, search, category, sort]);

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setCategory("all");
    setSort("new");
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Link>
          <h1 className="ml-4 text-sm font-semibold text-foreground">Product Catalog</h1>
          <div className="ml-auto">
            <OfflineIndicator />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {/* Search */}
        <div className="relative mb-5">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, brand, or barcode…"
            aria-label="Search the product catalog"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {/* Sort + Clear */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {dbTotal > 0 ? (
              <>
                <span className="font-medium text-foreground">{total.toLocaleString()}</span>{" "}
                {total !== dbTotal ? `of ${dbTotal.toLocaleString()}` : "products"} from the
                FoodGuard database
              </>
            ) : phase === "error" ? (
              "Catalog unavailable"
            ) : (
              "Loading catalog…"
            )}
          </p>

          <div className="flex items-center gap-2">
            <div className="relative">
              <SlidersHorizontal
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort products"
                className="min-h-11 rounded-xl border border-border bg-background py-2 pl-9 pr-8 text-sm font-medium text-foreground focus:border-primary focus:outline-none"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {(search || category !== "all") && (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-11 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Category chips */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={cn(
              "shrink-0 min-h-11 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              category === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted",
            )}
          >
            All {dbTotal > 0 ? `(${dbTotal.toLocaleString()})` : ""}
          </button>
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={cn(
                "shrink-0 min-h-11 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                category === c.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted",
              )}
            >
              {c.label} ({c.count.toLocaleString()})
            </button>
          ))}
        </div>

        {cachedEntry && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
            Showing saved results — refreshing in the background.
          </div>
        )}

        {isOffline && phase === "error" && (
          <div className="mb-4 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground" role="status">
            You&apos;re offline. Previously viewed catalog pages are available from saved data.
          </div>
        )}

        {/* Body */}
        {phase === "loading" && products.length === 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl border border-border bg-muted/40"
              />
            ))}
          </div>
        )}

        {phase === "error" && products.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border px-6 py-16 text-center">
            <Inbox className="size-10 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-base font-semibold text-foreground">Couldn&apos;t load the catalog</p>
              <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() =>
                fetchPage(1, { searchQ: search, cat: category, sortBy: sort, append: false })
              }
              className="mt-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try again
            </button>
          </div>
        )}

        {phase === "ready" && products.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border px-6 py-16 text-center">
            <Inbox className="size-10 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-base font-semibold text-foreground">No products found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search term or clear your filters.
              </p>
            </div>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Clear filters
            </button>
          </div>
        )}

        {products.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={phase === "loading" && page > 1}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {phase === "loading" && page > 1 ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Loading…
                    </>
                  ) : (
                    `Load more (${(total - page * PAGE_SIZE).toLocaleString()} remaining)`
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}