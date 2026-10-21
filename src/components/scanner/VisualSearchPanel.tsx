"use client";

import { useState, useRef, useCallback } from "react";
import { ScanEye, Upload, Link, Loader2, AlertCircle, Package } from "lucide-react";

interface VisualResult {
  rank: number;
  productName: string;
  productId?: string;
  score: number;
  imagePath?: string;
  sourceImageUrl?: string;
}

/** Fetch product images from local database for visual search results */
async function enrichWithDbImages(results: VisualResult[]): Promise<VisualResult[]> {
  const names = results.map((r) => r.productName).filter(Boolean);
  if (names.length === 0) return results;

  try {
    const res = await fetch("/api/product-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names }),
    });
    const data = await res.json();
    if (!data.success || !data.images) return results;

    return results.map((r) => ({
      ...r,
      sourceImageUrl: r.sourceImageUrl || data.images[r.productName] || "",
    }));
  } catch {
    return results;
  }
}

type VisualSearchPanelProps = {
  title?: string;
  uploadLabel?: string;
  uploadDesc?: string;
  urlLabel?: string;
  urlPlaceholder?: string;
  searchLabel?: string;
  searchingLabel?: string;
  onPick: (product: { name: string; id?: string; barcode?: string }) => void;
};

export function VisualSearchPanel({
  title = "Find Similar Products",
  uploadLabel = "Upload Product Photo",
  uploadDesc = "Take a photo or upload an image of the product",
  urlLabel = "Search by Image URL",
  urlPlaceholder = "Paste image URL here...",
  searchLabel = "Find Similar",
  searchingLabel = "Searching...",
  onPick,
}: VisualSearchPanelProps) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [results, setResults] = useState<VisualResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setError(null);
    setResults([]);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }, []);

  const openNativeScanner = useCallback(() => {
    // The Android app exposes FoodGuardBridge.openVisualScanner() (native camera/
    // gallery + circle). Fall back to the in-page upload picker elsewhere.
    const bridge = (window as unknown as Record<string, unknown>).FoodGuardBridge as
      | { openVisualScanner?: () => void }
      | undefined;
    if (bridge?.openVisualScanner) {
      bridge.openVisualScanner();
    } else {
      inputRef.current?.click();
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) handleFile(f);
  }, [handleFile]);

  const searchByFile = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("top_k", "10");

      const res = await fetch("/api/visual-search", {
        method: "POST",
        body: formData,
      });

      const text = await res.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Visual search service is unavailable");
      }

      const apiData = data as { success?: boolean; data?: { results?: Record<string, unknown>[] }; error?: { message?: string } };
      if (!apiData.success) throw new Error(apiData.error?.message || "Visual search failed");

      let results: VisualResult[] = (apiData.data?.results || []).map((r) => ({
        rank: (r.rank as number) ?? 0,
        productName: (r.productName as string) || (r.product_name as string) || "Unknown Product",
        productId: (r.productId as string) || (r.product_id as string),
        score: (r.score as number) ?? 0,
        imagePath: (r.imagePath as string) || (r.image_path as string),
        sourceImageUrl: (r.sourceImageUrl as string) || (r.source_image_url as string),
      }));

      // Enrich with product images from local database
      results = await enrichWithDbImages(results);

      setResults(results);
      if (results.length === 0) setError("No similar products found. Try a different image.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search");
    } finally {
      setLoading(false);
    }
  };

  const searchByURL = async () => {
    if (!imageUrl.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch("/api/visual-search-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl.trim(), top_k: 10 }),
      });

      const text = await res.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Visual search service is unavailable");
      }

      const apiData = data as { success?: boolean; data?: { results?: Record<string, unknown>[] }; error?: { message?: string } };
      if (!apiData.success) {
        const msg = apiData.error?.message || "Visual search failed";
        if (msg.includes("404") || msg.includes("fetch image")) {
          throw new Error("Could not fetch that image. Make sure the URL is a direct image link ending with .jpg, .png, or .webp — not a webpage.");
        }
        throw new Error(msg);
      }

      const results: VisualResult[] = (apiData.data?.results || []).map((r) => ({
        rank: (r.rank as number) ?? 0,
        productName: (r.productName as string) || (r.product_name as string) || "Unknown Product",
        productId: (r.productId as string) || (r.product_id as string),
        score: (r.score as number) ?? 0,
        imagePath: (r.imagePath as string) || (r.image_path as string),
        sourceImageUrl: (r.sourceImageUrl as string) || (r.source_image_url as string),
      }));

      // Enrich with product images from local database
      const enriched = await enrichWithDbImages(results);

      setResults(enriched);
      if (enriched.length === 0) setError("No similar products found. Try a different URL.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = mode === "upload" ? searchByFile : searchByURL;

  const handleReset = () => {
    setPreview(null);
    setFile(null);
    setImageUrl("");
    setResults([]);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <ScanEye className="size-4 text-primary" aria-hidden="true" />
        {title}
      </h3>

      {/* Mode tabs */}
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        <button
          type="button"
          onClick={() => { setMode("upload"); handleReset(); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            mode === "upload" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload className="size-4" aria-hidden="true" />
          Upload
        </button>
        <button
          type="button"
          onClick={() => { setMode("url"); handleReset(); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            mode === "url" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Link className="size-4" aria-hidden="true" />
          Image URL
        </button>
      </div>

      {/* Upload mode */}
      {mode === "upload" && !preview && (
        <>
          <button
            type="button"
            onClick={openNativeScanner}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <ScanEye className="size-4" aria-hidden="true" />
            FoodGuard Native Scanner
          </button>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50"
          >
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Upload className="size-8 text-primary" aria-hidden="true" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{uploadLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">{uploadDesc}</p>
            </div>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              <Upload className="size-4" aria-hidden="true" />
              Choose Image
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          </div>
        </>
      )}

      {/* Upload preview */}
      {mode === "upload" && preview && (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <img
              src={preview}
              alt="Product preview"
              className="w-full h-48 object-contain rounded-2xl bg-muted"
            />
            <button
              type="button"
              onClick={handleReset}
              className="absolute top-2 right-2 size-8 flex items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm hover:bg-background"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* URL mode */}
      {mode === "url" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => { setImageUrl(e.target.value); setError(null); setResults([]); }}
              placeholder={urlPlaceholder}
              className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
          </div>
          {!imageUrl && (
            <button
              type="button"
              onClick={() => setImageUrl("https://cdn.grofers.com/da/cms-assets/cms/product/rc-upload-1782125206312-12.jpg")}
              className="inline-flex items-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              Try example: Coca-Cola bottle
            </button>
          )}
          {imageUrl && !results.length && !loading && (
            <div className="flex justify-center">
              <img
                src={imageUrl}
                alt="Preview"
                className="max-h-40 rounded-xl object-contain bg-muted"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
        </div>
      )}

      {/* Search button */}
      {((mode === "upload" && preview) || (mode === "url" && imageUrl.trim())) && (
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {searchingLabel}
            </>
          ) : (
            <>
              <ScanEye className="size-4" aria-hidden="true" />
              {searchLabel}
            </>
          )}
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
          <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Found {results.length} similar products
          </p>
          {results.map((r) => {
            const similarity = Math.max(0, Math.round(100 - r.score));
            const imgSrc = r.sourceImageUrl || null;
            return (
            <button
              key={r.productId || r.rank}
              type="button"
              onClick={() =>
                onPick({
                  name: r.productName,
                  id: r.productId,
                })
              }
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
            >
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={r.productName}
                  className="size-14 shrink-0 rounded-xl object-cover bg-muted"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.onerror = null;
                    img.style.display = "none";
                    img.nextElementSibling?.classList.remove("hidden");
                  }}
                />
              ) : null}
              <div className={`flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 ${imgSrc ? "hidden" : ""}`}>
                <Package className="size-6 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{r.productName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Match: {similarity}% · Rank #{r.rank}
                </p>
              </div>
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
