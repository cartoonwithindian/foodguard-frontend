"use client";

import { useState, useCallback } from "react";
import { ArrowLeft, Search, ExternalLink, Loader2, ShieldAlert } from "lucide-react";
import { useSafeBack } from "@/lib/navigation/use-safe-back";

type ProviderKey = "usda" | "fda" | "pubchem" | "who" | "off";

type ProviderTab = {
  key: ProviderKey;
  label: string;
  description: string;
};

const PROVIDERS: ProviderTab[] = [
  { key: "usda", label: "USDA FoodData", description: "Search USDA food nutrient data (needs USDA_FDC_API_KEY)." },
  { key: "off", label: "Open Food Facts", description: "Look up a product by barcode." },
  { key: "pubchem", label: "PubChem", description: "Compound info by name or CID." },
  { key: "fda", label: "FDA", description: "Drug events, food recalls, drug labels." },
  { key: "who", label: "WHO GHO", description: "Global Health Observatory indicators." },
];

type RawResult = {
  url: string;
  body: string;
};

function formatBody(body: unknown): string {
  return JSON.stringify(body, null, 2);
}

export function ExternalDataPage() {
  const goBack = useSafeBack("/");
  const [active, setActive] = useState<ProviderKey>("usda");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RawResult | null>(null);
  const [error, setError] = useState<string>("");

  const run = useCallback(
    async (url: string) => {
      setLoading(true);
      setError("");
      setResult(null);
      try {
        const response = await fetch(url);
        const json = (await response.json()) as {
          success: boolean;
          data?: unknown;
          error?: { message?: string } | null;
          meta?: unknown;
        };
        if (!response.ok || !json.success) {
          setError(json.error?.message ?? `Request failed with status ${response.status}`);
          return;
        }
        setResult({ url, body: formatBody(json.data) });
      } catch {
        setError("Unable to reach the server. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = query.trim();
      if (!q) return;
      switch (active) {
        case "usda":
          void run(`/api/external/usda/search?query=${encodeURIComponent(q)}&pageSize=3`);
          break;
        case "off":
          if (!/^\d{4,32}$/.test(q)) {
            setError("Enter a valid barcode (4–32 digits).");
            return;
          }
          void run(`/api/external/openfoodfacts/product/${encodeURIComponent(q)}`);
          break;
        case "pubchem":
          void run(`/api/external/pubchem/compound?name=${encodeURIComponent(q)}`);
          break;
        case "fda":
          void run(`/api/external/fda/drug-events?search=${encodeURIComponent(q)}&limit=3`);
          break;
        case "who":
          void run("/api/external/who/indicators?top=20");
          break;
      }
    },
    [active, query, run],
  );

  const placeholder = {
    usda: "e.g. banana",
    off: "e.g. 3017620422003",
    pubchem: "e.g. caffeine",
    fda: "e.g. aspirin",
    who: "WHO doesn't need a query",
  }[active];

  const actionLabel = {
    usda: "Search USDA",
    off: "Look up barcode",
    pubchem: "Look up compound",
    fda: "Search FDA",
    who: "Load indicators",
  }[active];

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </button>
          <h1 className="ml-4 text-sm font-semibold text-foreground">External Data</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-5 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            External Data Sources
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live queries against public food, drug and health APIs. Results are fetched server-side.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setActive(p.key);
                setResult(null);
                setError("");
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                active === p.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-accent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          {PROVIDERS.find((p) => p.key === active)?.description}
        </p>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              disabled={loading || active === "who"}
              className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ExternalLink className="size-4" aria-hidden="true" />}
            {actionLabel}
          </button>
        </form>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <p className="break-all text-xs text-muted-foreground">
              GET <span className="font-mono">{result.url}</span>
            </p>
            <pre className="max-h-[60vh] overflow-auto rounded-xl border border-border bg-muted p-4 text-xs leading-relaxed text-foreground">
              {result.body}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
