import data from "@/data/product-image-urls.json";

export const runtime = "nodejs";

const BY_NAME: Record<string, string> = (data as { byNormalizedName: Record<string, string> })
  .byNormalizedName;

let WORD_KEYS: Map<string, string[]> | null = null;

/** word -> distinct normalized keys containing that word (built lazily, once). */
function wordKeys(): Map<string, string[]> {
  if (!WORD_KEYS) {
    WORD_KEYS = new Map();
    for (const key of Object.keys(BY_NAME)) {
      const words = key.split(" ");
      const seen = new Set<string>();
      for (const word of words) {
        if (word.length > 3 && !seen.has(word)) {
          seen.add(word);
          const list = WORD_KEYS.get(word);
          if (list) list.push(key);
          else WORD_KEYS.set(word, [key]);
        }
      }
    }
  }
  return WORD_KEYS;
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

/**
 * Fuzzy name -> image match. Scores candidate database keys by how many of the
 * query's significant words they contain; the highest-scoring candidate wins.
 * This keeps distinct products (e.g. different Kurkure flavours/sizes) from
 * collapsing onto a single image.
 */
function fuzzyResolve(norm: string): string {
  const qWords = norm.split(/\s+/).filter((w) => w.length > 3);
  if (qWords.length === 0) return "";

  const idx = wordKeys();
  const candidates = new Map<string, number>();
  for (const word of qWords) {
    const keys = idx.get(word);
    if (!keys) continue;
    for (const key of keys) {
      candidates.set(key, (candidates.get(key) ?? 0) + 1);
    }
  }

  let bestKey = "";
  let bestScore = -1;
  for (const [key, score] of candidates) {
    // Prefer matches on more query words; tie-break toward shorter names.
    const total = score + (key.length > 20 ? 0.5 : 0);
    if (total > bestScore) {
      bestScore = total;
      bestKey = key;
    }
  }
  return bestKey ? BY_NAME[bestKey] : "";
}

/**
 * POST /api/product-images
 *
 * Accepts JSON with a list of product names and returns matching product
 * image URLs from the bundled product database.
 *
 * Body: { names: string[] }
 * Returns: { success: true, images: Record<string, string> }
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => null);
    const names = body?.names;

    if (!Array.isArray(names) || names.length === 0) {
      return Response.json(
        { success: false, error: "No product names provided" },
        { status: 400 },
      );
    }

    const images: Record<string, string> = {};

    for (const name of names) {
      if (!name) continue;
      const norm = normalize(name);
      if (BY_NAME[norm]) {
        images[name] = BY_NAME[norm];
        continue;
      }

      // Fuzzy fallback: score candidate keys by token overlap with the name.
      const fuzzyUrl = fuzzyResolve(norm);
      if (fuzzyUrl) images[name] = fuzzyUrl;
    }

    return Response.json({ success: true, images });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}