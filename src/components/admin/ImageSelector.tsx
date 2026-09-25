"use client";

import { useState, useCallback, useRef } from "react";

import { apiUrl } from "@/lib/network/api-url";
import {
  Upload,
  Check,
  X,
  Search,
  ImageIcon,
  LinkIcon,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Star,
  ArrowLeft,
} from "lucide-react";

type Product = {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  category: string;
  imageUrl: string | null;
};

type CandidateImage = {
  id: string;
  url: string;
  source: "upload" | "url" | "existing";
  file?: File;
  objectUrl?: string;
};

type ImageSelectorProps = {
  products: Product[];
};

export function ImageSelector({ products }: ImageSelectorProps) {
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [candidates, setCandidates] = useState<CandidateImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search),
  );

  const handleSelectProduct = useCallback(
    (product: Product) => {
      setSelectedProduct(product);
      setSaved(false);
      const initial: CandidateImage[] = [];
      if (product.imageUrl) {
        initial.push({
          id: `existing-${product.id}`,
          url: product.imageUrl,
          source: "existing",
        });
      }
      setCandidates(initial);
      setSelectedImageId(initial[0]?.id ?? null);
    },
    [],
  );

  const addFiles = useCallback((files: FileList | File[]) => {
    const newCandidates: CandidateImage[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        url: URL.createObjectURL(file),
        source: "upload" as const,
        file,
      }));
    setCandidates((prev) => [...prev, ...newCandidates]);
    if (newCandidates.length > 0) {
      setSelectedImageId(newCandidates[0].id);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleAddUrl = useCallback(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    const newCandidate: CandidateImage = {
      id: `url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: trimmed,
      source: "url",
    };
    setCandidates((prev) => [...prev, newCandidate]);
    setSelectedImageId(newCandidate.id);
    setUrlInput("");
  }, [urlInput]);

  const handleRemoveCandidate = useCallback(
    (id: string) => {
      setCandidates((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (selectedImageId === id) {
          setSelectedImageId(next[0]?.id ?? null);
        }
        return next;
      });
    },
    [selectedImageId],
  );

  const handleSave = useCallback(async () => {
    if (!selectedProduct || !selectedImageId) return;
    const selected = candidates.find((c) => c.id === selectedImageId);
    if (!selected) return;

    setSaving(true);
    try {
      // If it's an uploaded file, we need to convert to a data URL or upload it
      let imageUrl = selected.url;
      if (selected.source === "upload" && selected.file) {
        // Convert to base64 data URL for storage (or upload to a service)
        imageUrl = await fileToDataUrl(selected.file);
      }

      const res = await fetch(apiUrl("/api/admin/product-image"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          imageUrl,
        }),
      });

      if (res.ok) {
        setSaved(true);
      }
    } catch {
      // Silently handle error
    } finally {
      setSaving(false);
    }
  }, [selectedProduct, selectedImageId, candidates]);

  const handleBack = useCallback(() => {
    // Clean up object URLs
    candidates.forEach((c) => {
      if (c.objectUrl) URL.revokeObjectURL(c.objectUrl);
    });
    setSelectedProduct(null);
    setCandidates([]);
    setSelectedImageId(null);
    setSaved(false);
  }, [candidates]);

  // ─── Product List View ─────────────────────────────────────
  if (!selectedProduct) {
    return (
      <div className="space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products by name, brand, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{filtered.length} products</span>
          <span>
            {filtered.filter((p) => !p.imageUrl).length} missing images
          </span>
        </div>

        {/* Product Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => (
            <button
              key={product.id}
              onClick={() => handleSelectProduct(product)}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
            >
              {/* Image Preview */}
              <div className="relative flex size-24 items-center justify-center overflow-hidden rounded-xl bg-muted/40">
                {product.imageUrl ? (
                  
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImageIcon className="size-6" />
                    <span className="text-xs">No image</span>
                  </div>
                )}
                {!product.imageUrl && (
                  <div className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                    !
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="w-full text-center">
                <p className="truncate text-sm font-medium text-card-foreground">
                  {product.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {product.brand ?? "Unknown brand"}
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {product.barcode}
                </p>
              </div>

              {/* Action hint */}
              <span className="text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Select images →
              </span>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Search className="size-8" />
            <p>No products match &ldquo;{search}&rdquo;</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Image Selection View ──────────────────────────────────
  const selectedCandidate = candidates.find((c) => c.id === selectedImageId);

  return (
    <div className="space-y-6">
      {/* Back + Product Info */}
      <div className="flex items-start gap-4">
        <button
          onClick={handleBack}
          className="mt-1 flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-card-foreground">
            {selectedProduct.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {selectedProduct.brand ?? "Unknown brand"} ·{" "}
            {selectedProduct.barcode}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!selectedImageId || saving}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>Saving...</>
          ) : saved ? (
            <>
              <Check className="size-4" /> Saved!
            </>
          ) : (
            <>
              <Check className="size-4" /> Set as Thumbnail
            </>
          )}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left: Image Gallery */}
        <div className="space-y-4">
          {/* Main Preview */}
          {selectedCandidate ? (
            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              
              <img
                src={selectedCandidate.url}
                alt="Selected thumbnail"
                className="max-h-full max-w-full object-contain"
              />
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <span className="rounded-lg bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                  {selectedCandidate.source === "existing"
                    ? "Current Image"
                    : selectedCandidate.source === "upload"
                      ? "Uploaded"
                      : "From URL"}
                </span>
              </div>
              {selectedCandidate.source === "existing" && (
                <div className="absolute bottom-3 right-3">
                  <span className="flex items-center gap-1 rounded-lg bg-primary/80 px-3 py-1 text-xs font-medium text-primary-foreground backdrop-blur">
                    <Star className="size-3" /> Current
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImageIcon className="size-12" />
                <p className="text-sm">
                  Upload images or add URLs to get started
                </p>
              </div>
            </div>
          )}

          {/* Thumbnail Strip */}
          {candidates.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {candidates.map((candidate, idx) => (
                <button
                  key={candidate.id}
                  onClick={() => setSelectedImageId(candidate.id)}
                  className={`relative flex size-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 transition-all ${
                    selectedImageId === candidate.id
                      ? "border-primary shadow-md ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  
                  <img
                    src={candidate.url}
                    alt={`Candidate ${idx + 1}`}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                  {selectedImageId === candidate.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                      <Check className="size-5 text-primary" />
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveCandidate(candidate.id);
                    }}
                    className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity hover:opacity-100"
                    style={{ opacity: undefined }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.opacity = "1")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.opacity = "")
                    }
                  >
                    <X className="size-3" />
                  </button>
                </button>
              ))}
            </div>
          )}

          {/* Navigation arrows for strip */}
          {candidates.length > 6 && (
            <div className="flex justify-center gap-2">
              <button className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted">
                <ChevronLeft className="size-4" />
              </button>
              <span className="flex items-center text-xs text-muted-foreground">
                {candidates.length} images
              </span>
              <button className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted">
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Upload Controls */}
        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <Upload
              className={`size-8 ${dragOver ? "text-primary" : "text-muted-foreground"}`}
            />
            <div>
              <p className="text-sm font-medium text-card-foreground">
                Drop images here
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                or click to browse · JPG, PNG, WEBP
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* URL Input */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Or paste an image URL
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
                  className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <button
                onClick={handleAddUrl}
                disabled={!urlInput.trim()}
                className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Tips */}
          <div className="rounded-2xl bg-accent/50 p-4">
            <p className="text-xs font-medium text-accent-foreground">
              💡 Tips for choosing a good thumbnail
            </p>
            <ul className="mt-2 space-y-1 text-xs text-accent-foreground/80">
              <li>• Front-facing product shot works best</li>
              <li>• Clear, well-lit images are preferred</li>
              <li>• Avoid cropped or blurry photos</li>
              <li>• Square or landscape orientation</li>
            </ul>
          </div>

          {/* Selected info */}
          {selectedCandidate && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Selected image
              </p>
              <p className="mt-1 truncate text-sm text-card-foreground">
                {selectedCandidate.source === "existing"
                  ? "Current product image"
                  : selectedCandidate.url.length > 50
                    ? selectedCandidate.url.slice(0, 50) + "..."
                    : selectedCandidate.url}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
