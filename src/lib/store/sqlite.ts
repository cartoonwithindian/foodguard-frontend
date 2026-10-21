import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type {
  NutritionFacts,
  ProductCategory,
  ProductInfo,
} from "@/types/domain";
import type { DataStore, ProductSearchResult } from "./types";
import type { ChatConversationRecord, ChatMessageRecord, ChatRole } from "@/types/chat";
import type {
  KnowledgeCategory,
  KnowledgeChunkRecord,
  KnowledgeDocumentRecord,
  KnowledgeSearchHit,
} from "@/types/knowledge";
import { cosineSimilarity, STOPWORDS } from "@/lib/embeddings";
import { InMemoryStore } from "./memory";
import type { ProductLookupResult } from "@/lib/product-provider";
import { logger } from "@/lib/logger";
import { normalizeNutritionFacts } from "@/lib/nutrition/units";

/**
 * Read/write store backed by the bundled FoodGuard SQLite database.
 * Product data lives in SQLite; product lookups that miss the SQLite file
 * return not-found and are resolved by configured external providers.
 */

const DEFAULT_DB_PATH = join(process.cwd(), "data", "foodguard", "foodguard.db");

export const SQLITE_DB_PATH = process.env.FOODGUARD_DB_PATH?.trim() || DEFAULT_DB_PATH;

export function hasSqliteDatabase(dbPath = SQLITE_DB_PATH): boolean {
  return existsSync(dbPath);
}

const CONFIDENCE_FLOOR = 0.5;
const SEARCH_LIMIT = 100;

// ── Local image index (loaded once from product-viewer/local-images-index.json) ──
const LOCAL_IMAGES_INDEX_PATH = join(process.cwd(), "product-viewer", "local-images-index.json");
let _localBarcodes: Set<string> | null = null;

function getLocalBarcodes(): Set<string> {
  if (_localBarcodes) return _localBarcodes;
  try {
    if (existsSync(LOCAL_IMAGES_INDEX_PATH)) {
      const raw = readFileSync(LOCAL_IMAGES_INDEX_PATH, "utf-8");
      _localBarcodes = new Set(JSON.parse(raw) as string[]);
    } else {
      _localBarcodes = new Set();
    }
  } catch {
    _localBarcodes = new Set();
  }
  return _localBarcodes;
}

function getLocalImageUrl(barcode: string | null | undefined): string | null {
  if (!barcode || !barcode.trim()) return null;
  const bc = barcode.trim();
  if (getLocalBarcodes().has(bc)) {
    return `/api/product-images/${bc}`;
  }
  return null;
}

// ── Row -> ProductInfo mapping ─────────────────────────────────
type ProductRow = {
  product_id: string;
  name: string | null;
  normalized_name: string | null;
  brand: string | null;
  normalized_brand: string | null;
  barcode: string | null;
  description: string | null;
  food_type: string | null;
  dietary: string | null;
  image_url: string | null;
  pack_size: string | null;
  price: string | null;
  data_status: string | null;
  completeness_score: number | null;
  confidence_score: number | null;
  created_at: string | null;
  updated_at: string | null;
};

function mapProductRow(
  row: ProductRow,
  barcodeFromKey?: string,
): ProductInfo {
  const confidence = typeof row.confidence_score === "number" && row.confidence_score > 0
    ? row.confidence_score
    : CONFIDENCE_FLOOR;
  const dataStatus = (row.data_status ?? "").toLowerCase();
  return {
    id: row.product_id,
    barcode: barcodeFromKey ?? row.barcode ?? "",
    name: row.name ?? `Product ${row.product_id}`,
    brand: row.brand ?? null,
    // The shipped dataset is Indian retail groceries; no category column exists.
    category: "food" as ProductCategory,
    country: "IN",
    servingSize: null,
    imageUrl: getLocalImageUrl(barcodeFromKey ?? row.barcode) ?? (row.image_url ?? null),
    ingredientsRaw: "",
    ingredientsNormalized: [],
    source: "foodguard_database",
    sourceUrl: null,
    verified: dataStatus === "verified",
    productDataConfidence: confidence,
    isDemo: false,
  };
}

// ── Nutrition parsing ─────────────────────────────────────────
function canonicalUnit(unit: string): string {
  const u = unit.trim().toLowerCase();
  const map: Record<string, string> = {
    g: "g", grams: "g", gm: "g", mg: "mg", milligrams: "mg", mcg: "mcg",
    micrograms: "mcg", kcal: "kcal", calories: "kcal", kj: "kJ", kJ: "kJ", ml: "ml",
  };
  return map[u] ?? u;
}

function numberFrom(token: string): number | null {
  const match = token.replace(",", "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseNutritionText(text: string): NutritionFacts | null {
  const nutrients: NutritionFacts["nutrients"] = {};
  const basis: "PER_100G" | "PER_SERVING" =
    /per\s+serving/i.test(text) ? "PER_SERVING" : "PER_100G";

  let servingSize: string | undefined;
  const servingMatch = text.match(/serving\s*size\s*[:=]\s*([^\r\n;]+)/i);
  if (servingMatch) servingSize = servingMatch[1].trim();

  let servingsPerContainer: string | undefined;
  const containerMatch = text.match(/servings?\s+per\s+container\s*[:=]\s*([^\r\n;]+)/i);
  if (containerMatch) servingsPerContainer = containerMatch[1].trim();

  const nutrientPattern =
    /(energy|protein|carbohydrates?|added\s+sugars?|total\s+sugars?|sugars?|total\s+fat|saturated\s+fats?|saturated\s+fatty\s+acids?|trans\s+fats?|trans\s+fatty\s+acids?|fib(?:er|re)|cholesterol|sodium|salt)\s*[:=]\s*([<\d][\d.,]*)\s*(kcal|kj|g|gram|grams|mg|milligram|milligrams|mcg|ml)?/gi;

  const targetUnit: Record<string, string> = {
    calories: "kcal", energyKj: "kJ", sodium: "mg", cholesterol: "mg", protein: "g",
    carbohydrates: "g", sugars: "g", addedSugars: "g", totalFat: "g",
    saturatedFat: "g", transFat: "g", fiber: "g", salt: "g",
  };

  const labelToKey: Record<string, string> = {
    energy: "calories",
    protein: "protein",
    carbohydrate: "carbohydrates",
    carbohydrates: "carbohydrates",
    "added sugars": "addedSugars",
    "added sugar": "addedSugars",
    "total sugars": "sugars",
    "total sugar": "sugars",
    sugars: "sugars",
    sugar: "sugars",
    "total fat": "totalFat",
    "saturated fat": "saturatedFat",
    "saturated fats": "saturatedFat",
    "saturated fatty acids": "saturatedFat",
    "trans fat": "transFat",
    "trans fats": "transFat",
    "trans fatty acids": "transFat",
    fiber: "fiber",
    fibre: "fiber",
    cholesterol: "cholesterol",
    sodium: "sodium",
    salt: "salt",
  };

  let match: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((match = nutrientPattern.exec(text)) !== null) {
    const label = match[1].toLowerCase();
    const key = labelToKey[label] ?? null;
    if (!key || seen.has(key)) continue;
    const value = numberFrom(match[2]);
    if (value === null) continue;
    const explicitUnit = match[3]?.toLowerCase() ?? "";
    const unit = explicitUnit ? canonicalUnit(explicitUnit) : targetUnit[key] ?? "g";
    nutrients[key] = { value, unit, confidence: CONFIDENCE_FLOOR };
    seen.add(key);
  }

  if (Object.keys(nutrients).length === 0) return null;
  return normalizeNutritionFacts({
    basis,
    servingSize,
    servingsPerContainer,
    nutrients,
  });
}

const STRUCTURED_KEY_MAP: Array<{ keys: string[]; key: string; unit: string }> = [
  { keys: ["energy"], key: "calories", unit: "kcal" },
  { keys: ["protein"], key: "protein", unit: "g" },
  { keys: ["carbohydrate"], key: "carbohydrates", unit: "g" },
  { keys: ["added sugars"], key: "addedSugars", unit: "g" },
  { keys: ["total sugars"], key: "sugars", unit: "g" },
  { keys: ["sugars"], key: "sugars", unit: "g" },
  { keys: ["saturated fat"], key: "saturatedFat", unit: "g" },
  { keys: ["trans fat"], key: "transFat", unit: "g" },
  { keys: ["total fat"], key: "totalFat", unit: "g" },
  { keys: ["fat"], key: "totalFat", unit: "g" },
  { keys: ["fiber", "fibre"], key: "fiber", unit: "g" },
  { keys: ["cholesterol"], key: "cholesterol", unit: "mg" },
  { keys: ["sodium"], key: "sodium", unit: "mg" },
  { keys: ["salt"], key: "salt", unit: "g" },
];

function parseStructuredNutrition(obj: Record<string, unknown>): NutritionFacts | null {
  const nutrients: NutritionFacts["nutrients"] = {};
  for (const [rawKey, rawValue] of Object.entries(obj)) {
    const keyNorm = rawKey.toLowerCase().replace(/\s*\(.*\)\s*$/, "").replace(/_/g, " ").trim();
    const value = typeof rawValue === "number" ? rawValue : numberFrom(String(rawValue));
    if (value === null) continue;
    const unitMatch = rawKey.toLowerCase().match(/\((kcal|kj|g|mg|mcg|ml)\)/);
    const explicitUnit = unitMatch?.[1] ?? "";
    for (const rule of STRUCTURED_KEY_MAP) {
      if (rule.keys.some((k) => keyNorm.includes(k))) {
        const unit = explicitUnit ? canonicalUnit(explicitUnit) : rule.unit;
        // Do not overwrite a more specific match (e.g. added sugars vs sugars).
        if (keyNorm.includes("added") && rule.key === "sugars") continue;
        nutrients[rule.key] = { value, unit, confidence: CONFIDENCE_FLOOR };
        break;
      }
    }
  }
  if (Object.keys(nutrients).length === 0) return null;
  return normalizeNutritionFacts({ basis: "PER_100G", nutrients });
}

function parseNutritionBlob(raw: unknown): NutritionFacts | null {
  if (raw == null) return null;
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  if (!text.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  if (typeof parsed === "string") return parseNutritionText(parsed);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    // A record we wrote ourselves round-trips as a full NutritionFacts.
    if (obj.nutrients && typeof obj.nutrients === "object" && !Array.isArray(obj.nutrients)) {
      const nuts = obj.nutrients as Record<string, unknown>;
      const nutrients: NutritionFacts["nutrients"] = {};
      for (const [k, v] of Object.entries(nuts)) {
        if (v && typeof v === "object" && "value" in v && "unit" in v) {
          const nv = v as { value: unknown; unit: unknown; confidence?: unknown };
          if (typeof nv.value === "number" && typeof nv.unit === "string") {
            nutrients[k] = {
              value: nv.value,
              unit: nv.unit,
              confidence: typeof nv.confidence === "number" ? nv.confidence : CONFIDENCE_FLOOR,
            };
          }
        }
      }
      if (Object.keys(nutrients).length === 0) return null;
      return normalizeNutritionFacts({
        basis: obj.basis === "PER_SERVING" ? "PER_SERVING" : "PER_100G",
        servingSize: typeof obj.servingSize === "string" ? obj.servingSize : undefined,
        servingsPerContainer: typeof obj.servingsPerContainer === "string" ? obj.servingsPerContainer : undefined,
        nutrients,
      });
    }
    return parseStructuredNutrition(obj);
  }
  return null;
}

// ── Catalog browsing (real products, no static/fake data) ─────
export type CatalogCategoryDef = { key: string; label: string; keywords: string[] };

/**
 * Browsing categories derived from real product names (the bundled FoodGuard
 * DB has no category column). The empty `categories` table is not used.
 * Matching is substring-based on name, so it is a browsing aid only — the
 * products themselves are always the real DB rows, never fabricated.
 */
export const CATALOG_CATEGORIES: CatalogCategoryDef[] = [
  { key: "snacks", label: "Snacks", keywords: ["chips", "namkeen", "kurkure", "bhujia", "chakli", "murukku", "khakhra", "murmura", "makhana", "puff"] },
  { key: "biscuits", label: "Biscuits & Cookies", keywords: ["biscuit", "cookie", "cookies", "cream cracker", "digestive", "rusk", "glucose biscuits"] },
  { key: "beverages", label: "Beverages", keywords: ["tea", "coffee", "juice", "drink", "beverage", "squash", "syrup", "smoothie", "energy drink", "nimbu", "limca", "soda", "water"] },
  { key: "dairy", label: "Dairy", keywords: ["milk", "curd", "yogurt", "yoghurt", "ghee", "paneer", "cheese", "cream", "lassi", "dahi", "malai"] },
  { key: "staples", label: "Staples & Grains", keywords: ["rice", "atta", "flour", "maida", "sooji", "suji", "dal", "pulse", "sugar", "salt", "oil", "spice", "masala", "turmeric", "besan", "poha", "sabudana", "wheat"] },
  { key: "instant", label: "Instant & Ready-to-Eat", keywords: ["noodle", "maggi", "instant", "pasta", "vermicelli", "oats", "cereal", "corn flakes", "muesli", "porridge", "chowmein", "brooke bond"] },
  { key: "sweets", label: "Sweets & Chocolates", keywords: ["chocolate", "candy", "toffee", "barfi", "laddoo", "laddu", "rasgulla", "cake", "pastry", "jalebi", "mithai", "chewing gum", "chocolate"] },
];

export type CatalogFilterInput = {
  search?: string;
  category?: string;
  sort?: string;
  offset?: number;
  limit?: number;
};

export type CatalogProductItem = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string;
  category: string;
  categoryLabel: string;
  imageUrl: string | null;
  packSize: string | null;
  price: string | null;
  source: string | null;
  cardCreatedAt: string | null;
  verified: boolean;
  confidence: number;
  hasNutrition: boolean;
  hasIngredients: boolean;
  hasBarcode: boolean;
};

export type CatalogPageResult = {
  products: CatalogProductItem[];
  /** Products matching the current search + category filter. */
  total: number;
  /** Total rows in the products table (whole FoodGuard database). */
  dbTotal: number;
  categories: Array<{ key: string; label: string; count: number }>;
};

/**
 * Normalize a product image URL for UI consumption: only absolute
 * http(s) URLs pass through; anything else (relative paths, garbage,
 * empty strings) becomes null so the UI always falls back to its
 * placeholder instead of rendering a broken image.
 */
export function normalizeProductImageUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\/[^\s]+$/i.test(trimmed)) return null;
  return trimmed;
}

export type DbHealthReport = {
  totalProducts: number;
  missingName: number;
  missingBarcode: number;
  missingBrand: number;
  missingImage: number;
  missingIngredients: number;
  missingNutrition: number;
  invalidBarcode: number;
  duplicateBarcodes: number;
  productsWithDuplicateBarcode: number;
  malformedNutrition: number;
  malformedIngredients: number;
  verifiedProducts: number;
};

export function classifyCatalogCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const cat of CATALOG_CATEGORIES) {
    if (cat.keywords.some((kw) => lower.includes(kw))) return cat.key;
  }
  return "other";
}

function catalogCategorySql(category: string): string | null {
  const def = CATALOG_CATEGORIES.find((c) => c.key === category);
  if (!def) return null;
  const clause = def.keywords
    .map((kw) => `name LIKE '%${escapeLike(kw)}%'`)
    .join(" OR ");
  return `(${clause})`;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function catalogSortOrder(sort: string): string {
  switch (sort) {
    case "name_asc":
      return "name COLLATE NOCASE ASC, product_id";
    case "name_desc":
      return "name COLLATE NOCASE DESC, product_id";
    case "brand":
      return "brand COLLATE NOCASE ASC, name COLLATE NOCASE ASC";
    case "rating":
      return "CAST(rating AS REAL) DESC, product_id";
    case "new":
    default:
      return "created_at DESC, product_id";
  }
}
export class SqliteStore extends InMemoryStore implements DataStore {
  private db: DatabaseSync | null = null;

  constructor(private readonly dbPath = SQLITE_DB_PATH) {
    super(false);
  }

  private ensureOpen(): DatabaseSync {
    if (this.db) return this.db;
    if (!existsSync(this.dbPath)) {
      throw new Error(`FoodGuard SQLite database not found at ${this.dbPath}`);
    }
    this.db = new DatabaseSync(this.dbPath, { timeout: 10_000 });
    this.db.exec("PRAGMA journal_mode = WAL;");
    return this.db;
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private getProductRow(barcode: string): { row: ProductRow; barcode: string } | null {
    const db = this.ensureOpen();
    const viaBarcodes = db
      .prepare(
        `SELECT p.* FROM barcodes b
         JOIN products p ON p.product_id = b.product_id
         WHERE b.barcode = ?`,
      )
      .get(barcode);
    if (viaBarcodes) return { row: viaBarcodes as unknown as ProductRow, barcode };
    const viaProducts = db
      .prepare(`SELECT * FROM products WHERE barcode = ?`)
      .get(barcode);
    if (viaProducts) return { row: viaProducts as unknown as ProductRow, barcode };
    return null;
  }

  private productByIdRow(id: string): ProductRow | null {
    const db = this.ensureOpen();
    const row = db.prepare(`SELECT * FROM products WHERE product_id = ?`).get(id);
    return (row as unknown as ProductRow) ?? null;
  }

  private attachIngredients(row: ProductRow): { raw: string; normalized: string[] } {
    const db = this.ensureOpen();
    const rows = db
      .prepare(
        `SELECT i.name, i.normalized_name, pi.position
         FROM product_ingredients pi
         JOIN ingredients i ON i.ingredient_id = pi.ingredient_id
         WHERE pi.product_id = ?
         ORDER BY pi.position`,
      )
      .all(row.product_id) as Array<{ name: string | null; normalized_name: string | null }>;
    const names = rows.map((r) => r.name).filter((n): n is string => !!n);
    const normalized = rows
      .map((r) => r.normalized_name)
      .filter((n): n is string => !!n);
    return { raw: names.join(", "), normalized };
  }

  private toProductInfo(row: ProductRow, barcode?: string): ProductInfo {
    const product = mapProductRow(row, barcode);
    const { raw, normalized } = this.attachIngredients(row);
    product.ingredientsRaw = raw;
    product.ingredientsNormalized = normalized;
    const db = this.ensureOpen();
    const sourceRow = db
      .prepare(
        `SELECT s.name, ps.url
         FROM product_sources ps
         JOIN sources s ON s.source_id = ps.source_id
         WHERE ps.product_id = ?
         LIMIT 1`,
      )
      .get(row.product_id) as { name: string; url: string | null } | undefined;
    if (sourceRow) {
      product.source = sourceRow.name;
      product.sourceUrl = sourceRow.url ?? null;
    }
    return product;
  }

  private saveIngredients(db: DatabaseSync, productId: string, raw: string): void {
    const names = raw
      .split(/[,;]\s*|\band\b/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (names.length === 0) return;
    const findStmt = db.prepare(`SELECT ingredient_id FROM ingredients WHERE name = ? LIMIT 1`);
    const insertStmt = db.prepare(
      `INSERT INTO ingredients (name, normalized_name) VALUES (?, ?)`,
    );
    const linkStmt = db.prepare(
      `INSERT INTO product_ingredients (product_id, ingredient_id, original_text, position)
       VALUES (?, ?, ?, ?)`,
    );
    names.forEach((name, position) => {
      const existing = findStmt.get(name) as { ingredient_id: number } | undefined;
      let ingredientId: number;
      if (existing) {
        ingredientId = existing.ingredient_id;
      } else {
        const result = insertStmt.run(name, name.toLowerCase());
        ingredientId = Number(result.lastInsertRowid);
      }
      linkStmt.run(productId, ingredientId, name, position);
    });
  }

  // ── products ──────────────────────────────────────────────
  async getProductByBarcode(barcode: string): Promise<ProductInfo | null> {
    const hit = this.getProductRow(barcode.trim());
    if (hit) return this.toProductInfo(hit.row, hit.barcode);
    return null;
  }

  async getProductById(id: string): Promise<ProductInfo | null> {
    const row = this.productByIdRow(id);
    if (row) return this.toProductInfo(row);
    return null;
  }

  async getNutritionForProduct(productId: string): Promise<NutritionFacts | null> {
    if (this.productByIdRow(productId)) {
      const db = this.ensureOpen();
      const row = db
        .prepare(`SELECT nutrition_json FROM nutrition WHERE product_id = ?`)
        .get(productId) as { nutrition_json: string } | undefined;
      if (row) {
        const parsed = parseNutritionBlob(row.nutrition_json);
        if (parsed) return parsed;
      }
      // Nutrition quality is mixed in the shipped DB; fall through to the
      // nutrition cascade (USDA -> API Ninjas) when parsing yields nothing.
      return null;
    }
    return null;
  }

  async saveProductFromProvider(lookup: ProductLookupResult): Promise<ProductLookupResult> {
    if (!lookup.product || !lookup.product.barcode.trim()) return lookup;
    const barcode = lookup.product.barcode.trim();
    const existing = await this.getProductByBarcode(barcode);
    if (existing) {
      return {
        product: existing,
        nutrition: await this.getNutritionForProduct(existing.id),
        source: lookup.source,
      };
    }
    const db = this.ensureOpen();
    const id = `FG_${randomBytes(4).toString("hex").toUpperCase()}`;
    const now = new Date().toISOString();
    const p = lookup.product;
    const confidence = p.productDataConfidence > 0 ? p.productDataConfidence : CONFIDENCE_FLOOR;

    try {
      db.exec("BEGIN");
      try {
        db.prepare(
          `INSERT INTO products (
             product_id, name, normalized_name, brand, normalized_brand, barcode,
             description, dietary, image_url, data_status,
             completeness_score, confidence_score, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          p.name,
          p.name.toLowerCase(),
          p.brand,
          p.brand?.toLowerCase() ?? null,
          barcode,
          null,
          null,
          p.imageUrl,
          p.verified ? "verified" : "enriched",
          confidence * 100,
          confidence,
          now,
          now,
        );
        db.prepare(
          `INSERT OR REPLACE INTO barcodes (barcode, product_id, source, confidence)
           VALUES (?, ?, ?, ?)`,
        ).run(barcode, id, lookup.source, confidence);

        if (lookup.nutrition) {
          db.prepare(
            `INSERT OR REPLACE INTO nutrition (product_id, nutrition_json, source)
             VALUES (?, ?, ?)`,
          ).run(
            id,
            JSON.stringify({
              basis: lookup.nutrition.basis,
              servingSize: lookup.nutrition.servingSize,
              servingsPerContainer: lookup.nutrition.servingsPerContainer,
              nutrients: lookup.nutrition.nutrients,
            }),
            lookup.source,
          );
        }

        db.prepare(`INSERT OR IGNORE INTO sources (name) VALUES (?)`).run(lookup.source);
        const sourceRow = db.prepare(`SELECT source_id FROM sources WHERE name = ?`).get(lookup.source) as
          | { source_id: number }
          | undefined;
        db.prepare(
          `INSERT OR IGNORE INTO product_sources (product_id, source_id, url)
           VALUES (?, ?, ?)`,
        ).run(id, sourceRow?.source_id ?? -1, p.sourceUrl ?? null);

        if (p.ingredientsRaw) {
          this.saveIngredients(db, id, p.ingredientsRaw);
        }

        db.exec("COMMIT");
        logger.info("sqlite_product_saved", { barcode, id, source: lookup.source });
        return {
          product: this.toProductInfo(this.productByIdRow(id)!, barcode),
          nutrition: lookup.nutrition,
          source: lookup.source,
        };
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    } catch (error) {
      logger.warn("sqlite_save_failed", { barcode, error: String(error) });
      return { product: lookup.product, nutrition: lookup.nutrition, source: lookup.source };
    }
  }

  async searchProducts(query: string, category: ProductCategory | "all" = "all"): Promise<ProductSearchResult[]> {
    const db = this.ensureOpen();
    const q = query.trim().toLowerCase();
    const sqliteResults: ProductSearchResult[] = [];

    if (category === "all" || category === "food") {
      const params: unknown[] = [];
      let where = "";
      if (q) {
        const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
        where =
          `WHERE (name LIKE ? ESCAPE '\\'
            OR brand LIKE ? ESCAPE '\\'
            OR barcode LIKE ? ESCAPE '\\'
            OR normalized_name LIKE ? ESCAPE '\\'
            OR normalized_brand LIKE ? ESCAPE '\\')`;
        params.push(like, like, like, like, like);
      }
      const rows = db
        .prepare(
          `SELECT * FROM products
           ${where}
           ORDER BY completeness_score DESC, name
           LIMIT ${SEARCH_LIMIT}`,
        )
        .all(...params) as unknown as ProductRow[];

      for (const row of rows) {
        const product = this.toProductInfo(row);
        let rank = 50;
        const matchedOn: string[] = [];
        if (q) {
          const name = product.name.toLowerCase();
          const brand = product.brand?.toLowerCase() ?? "";
          if (name === q) {
            rank += 50;
            matchedOn.push("name");
          } else if (name.startsWith(q)) {
            rank += 40;
            matchedOn.push("name");
          } else if (name.includes(q)) {
            rank += 20;
            matchedOn.push("name");
          }
          if (brand.includes(q)) {
            rank += 10;
            matchedOn.push("brand");
          }
          if (product.barcode.includes(q)) {
            rank += 30;
            matchedOn.push("barcode");
          }
        }
        sqliteResults.push({ product, rank, matchedOn });
      }
    }

    const memoryResults = await super.searchProducts(query, category);
    const seen = new Set(sqliteResults.map((r) => r.product.id));
    for (const mr of memoryResults) {
      if (!seen.has(mr.product.id)) {
        sqliteResults.push(mr);
        seen.add(mr.product.id);
      }
    }
    return sqliteResults.sort((a, b) => b.rank - a.rank).slice(0, SEARCH_LIMIT);
  }

  async updateProductImage(productId: string, imageUrl: string): Promise<void> {
    const db = this.ensureOpen();
    db.prepare(`UPDATE products SET image_url = ? WHERE id = ?`).run(imageUrl, productId);
  }

  // ── catalog browsing (server-side paging, real DB rows) ────
  private catalogFilter(search: string, category: string): {
    clause: string;
    params: unknown[];
  } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    const q = search.trim().toLowerCase();
    if (q) {
      const like = `%${escapeLike(q)}%`;
      conditions.push(
        `(name LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\'
          OR barcode LIKE ? ESCAPE '\\' OR normalized_name LIKE ? ESCAPE '\\'
          OR normalized_brand LIKE ? ESCAPE '\\')`,
      );
      params.push(like, like, like, like, like);
    }
    const categoryClause = catalogCategorySql(category);
    if (categoryClause) conditions.push(categoryClause);
    return {
      clause: conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "",
      params,
    };
  }

  async listCatalog(input: CatalogFilterInput = {}): Promise<CatalogPageResult> {
    const db = this.ensureOpen();
    const search = input.search ?? "";
    const category = input.category ?? "all";
    const limit = Math.min(Math.max(input.limit ?? 24, 1), 50);
    const offset = Math.max(input.offset ?? 0, 0);
    const { clause, params } = this.catalogFilter(search, category);

    const countRow = db
      .prepare(
        `SELECT COUNT(*) AS total FROM products
         ${clause}`,
      )
      .get(...params) as { total: number };
    void countRow;

    const rows = db
      .prepare(
        `SELECT p.*,
            (SELECT s.name FROM product_sources ps
             JOIN sources s ON s.source_id = ps.source_id
             WHERE ps.product_id = p.product_id
             ORDER BY ps.source_id LIMIT 1) AS source_name,
            EXISTS(SELECT 1 FROM nutrition n
                   WHERE n.product_id = p.product_id
                     AND n.nutrition_json IS NOT NULL AND n.nutrition_json != '') AS has_nutrition,
            EXISTS(SELECT 1 FROM product_ingredients pi
                   WHERE pi.product_id = p.product_id) AS has_ingredients
         FROM products p
         ${clause}
         ORDER BY ${catalogSortOrder(input.sort ?? "new")}
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as unknown as Array<
      ProductRow & { source_name: string | null; has_nutrition: number; has_ingredients: number }
    >;

    const products: CatalogProductItem[] = rows.map((row) => {
      const categoryKey = classifyCatalogCategory(row.name ?? "");
      const categoryDef = CATALOG_CATEGORIES.find((c) => c.key === categoryKey);
      return {
        id: row.product_id,
        name: row.name ?? `Product ${row.product_id}`,
        brand: row.brand ?? null,
        barcode: row.barcode ?? "",
        category: categoryKey,
        categoryLabel: categoryDef?.label ?? "Other",
        imageUrl: getLocalImageUrl(row.barcode) ?? normalizeProductImageUrl(row.image_url),
        packSize: row.pack_size && row.pack_size.trim() ? row.pack_size : null,
        price: row.price && row.price.trim() ? row.price : null,
        source: row.source_name ?? null,
        cardCreatedAt: row.created_at ?? null,
        verified: (row.data_status ?? "").toLowerCase() === "verified",
        confidence: typeof row.confidence_score === "number" ? row.confidence_score : 0,
        hasNutrition: Boolean(row.has_nutrition),
        hasIngredients: Boolean(row.has_ingredients),
        hasBarcode: Boolean(row.barcode && row.barcode.trim()),
      };
    });

    return { products, total: countRow.total, dbTotal: this.dbTotal(), categories: await this.catalogCategories(search) };
  }

  private dbTotal(): number {
    const db = this.ensureOpen();
    const row = db.prepare("SELECT COUNT(*) AS c FROM products").get() as { c: number };
    return Number(row.c ?? 0);
  }

  async catalogCategories(search: string): Promise<Array<{ key: string; label: string; count: number }>> {
    const db = this.ensureOpen();
    const q = search.trim().toLowerCase();
    const counts: Array<{ key: string; label: string; count: number }> = [];
    if (q) {
      const like = `%${escapeLike(q)}%`;
      for (const cat of CATALOG_CATEGORIES) {
        const whereSql = `WHERE (name LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\' OR barcode LIKE ? ESCAPE '\\' OR normalized_name LIKE ? ESCAPE '\\' OR normalized_brand LIKE ? ESCAPE '\\') AND ${catalogCategorySql(cat.key)}`;
        const row = db.prepare(`SELECT COUNT(*) AS total FROM products ${whereSql}`)
          .get(like, like, like, like, like) as { total: number };
        counts.push({ key: cat.key, label: cat.label, count: row.total });
      }
    } else {
      const selectParts = CATALOG_CATEGORIES.map((cat) =>
        `SUM(${catalogCategorySql(cat.key)}) AS "c_${cat.key}"`,
      ).join(", ");
      const row = db.prepare(
        `SELECT ${selectParts} FROM products`,
      ).get() as Record<string, number>;
      for (const cat of CATALOG_CATEGORIES) {
        counts.push({ key: cat.key, label: cat.label, count: Number(row[`c_${cat.key}`] ?? 0) });
      }
    }
    const categoryTotal = counts.reduce((sum, c) => sum + c.count, 0);
    const dbRow = db.prepare("SELECT COUNT(*) AS c FROM products").get() as { c: number };
    const otherCount = Math.max(Number(dbRow.c ?? 0) - categoryTotal, 0);
    const withOthers: Array<{ key: string; label: string; count: number }> = [...counts, { key: "other", label: "Other", count: otherCount }];
    return withOthers.sort((a, b) => b.count - a.count);
  }

  async dbHealth(): Promise<DbHealthReport> {
    const db = this.ensureOpen();
    const one = (sql: string): number => {
      const row = db.prepare(sql).get() as { c?: number; total?: number } | undefined;
      return Number(row?.c ?? row?.total ?? 0);
    };
    const total = one("SELECT COUNT(*) AS c FROM products");
    const dupRow = db.prepare(
      `SELECT COUNT(*) AS c, COALESCE(SUM(cnt), 0) AS total_dup
       FROM (SELECT barcode, COUNT(*) AS cnt FROM products
             WHERE barcode IS NOT NULL AND barcode != ''
             GROUP BY barcode HAVING cnt > 1)`,
    ).get() as { c: number; total_dup: number };
    const malformedIngredients = one(
      `SELECT COUNT(*) AS c FROM product_ingredients pi
       JOIN ingredients i ON i.ingredient_id = pi.ingredient_id
       WHERE i.name IS NULL OR TRIM(i.name) = ''`,
    );
    return {
      totalProducts: total,
      missingName: one(`SELECT COUNT(*) AS c FROM products WHERE name IS NULL OR TRIM(name) = ''`),
      missingBarcode: one(`SELECT COUNT(*) AS c FROM products WHERE barcode IS NULL OR TRIM(barcode) = ''`),
      missingBrand: one(`SELECT COUNT(*) AS c FROM products WHERE brand IS NULL OR TRIM(brand) = ''`),
      missingImage: one(`SELECT COUNT(*) AS c FROM products WHERE image_url IS NULL OR TRIM(image_url) = ''`),
      missingIngredients: one(`SELECT COUNT(*) AS c FROM products p WHERE NOT EXISTS (SELECT 1 FROM product_ingredients pi WHERE pi.product_id = p.product_id)`),
      missingNutrition: one(`SELECT COUNT(*) AS c FROM products p WHERE NOT EXISTS (SELECT 1 FROM nutrition n WHERE n.product_id = p.product_id)`),
      invalidBarcode: one(`SELECT COUNT(*) AS c FROM products WHERE barcode IS NOT NULL AND TRIM(barcode) != '' AND (NOT TRIM(barcode) GLOB '*[0-9]*' OR length(TRIM(barcode)) < 4 OR length(TRIM(barcode)) > 32)`),
      duplicateBarcodes: dupRow.c,
      productsWithDuplicateBarcode: dupRow.total_dup,
      malformedNutrition: one(`SELECT COUNT(*) AS c FROM nutrition WHERE nutrition_json IS NULL OR TRIM(nutrition_json) = ''`),
      malformedIngredients,
      verifiedProducts: one(`SELECT COUNT(*) AS c FROM products WHERE data_status = 'verified'`),
    };
  }

  // ── chat conversations (persistent, additive tables) ─────
  private ensureChatSchema(): DatabaseSync {
    const db = this.ensureOpen();
    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON chat_conversations(user_id, updated_at);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);
    `);
    return db;
  }

  private ensureKnowledgeSchema(): DatabaseSync {
    const db = this.ensureOpen();
    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source TEXT NOT NULL,
        source_url TEXT NOT NULL,
        category TEXT NOT NULL,
        document_version TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        content TEXT NOT NULL,
        section TEXT NOT NULL,
        page_number INTEGER,
        metadata TEXT NOT NULL DEFAULT '{}',
        embedding TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document ON knowledge_chunks(document_id);
    `);
    return db;
  }

  async createConversation(userId: string): Promise<ChatConversationRecord> {
    const db = this.ensureChatSchema();
    const id = `conv-${randomBytes(8).toString("hex")}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO chat_conversations (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    ).run(id, userId, now, now);
    return { id, userId, createdAt: now, updatedAt: now };
  }

  async listConversations(userId: string): Promise<ChatConversationRecord[]> {
    const db = this.ensureChatSchema();
    const rows = db
      .prepare(
        `SELECT * FROM chat_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50`,
      )
      .all(userId) as Array<{ id: string; user_id: string; created_at: string; updated_at: string }>;
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async getConversation(conversationId: string): Promise<ChatConversationRecord | null> {
    const db = this.ensureChatSchema();
    const row = db
      .prepare(`SELECT * FROM chat_conversations WHERE id = ?`)
      .get(conversationId) as { id: string; user_id: string; created_at: string; updated_at: string } | undefined;
    if (!row) return null;
    return { id: row.id, userId: row.user_id, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  async appendChatMessage(
    conversationId: string,
    userId: string,
    role: ChatRole,
    content: string,
  ): Promise<ChatMessageRecord> {
    const db = this.ensureChatSchema();
    const conversation = await this.getConversation(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error(`Conversation ${conversationId} not found for user ${userId}`);
    }
    const id = `msg-${randomBytes(8).toString("hex")}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO chat_messages (id, conversation_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, conversationId, userId, role, content, now);
    db.prepare(`UPDATE chat_conversations SET updated_at = ? WHERE id = ?`).run(now, conversationId);
    return { id, conversationId, userId, role, content, createdAt: now };
  }

  async listChatMessages(conversationId: string, limit = 50): Promise<ChatMessageRecord[]> {
    const db = this.ensureChatSchema();
    const rows = db
      .prepare(
        `SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?`,
      )
      .all(conversationId, limit) as Array<{
      id: string;
      conversation_id: string;
      user_id: string;
      role: string;
      content: string;
      created_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      userId: r.user_id,
      role: r.role === "assistant" ? "assistant" : "user",
      content: r.content,
      createdAt: r.created_at,
    }));
  }

  // ── knowledge base (RAG) ──────────────────────────────────
  async upsertKnowledgeDocument(doc: KnowledgeDocumentRecord): Promise<void> {
    const db = this.ensureKnowledgeSchema();
    db.prepare(
      `INSERT INTO knowledge_documents (id, title, source, source_url, category, document_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         source = excluded.source,
         source_url = excluded.source_url,
         category = excluded.category,
         document_version = excluded.document_version,
         updated_at = excluded.updated_at`,
    ).run(
      doc.id,
      doc.title,
      doc.source,
      doc.sourceUrl,
      doc.category,
      doc.documentVersion,
      doc.createdAt,
      doc.updatedAt,
    );
  }

  async listKnowledgeDocuments(category?: string): Promise<KnowledgeDocumentRecord[]> {
    const db = this.ensureKnowledgeSchema();
    const rows = category
      ? db.prepare(`SELECT * FROM knowledge_documents WHERE category = ? ORDER BY title`).all(category)
      : db.prepare(`SELECT * FROM knowledge_documents ORDER BY title`).all();
    return (rows as Array<{
      id: string;
      title: string;
      source: string;
      source_url: string;
      category: string;
      document_version: string;
      created_at: string;
      updated_at: string;
    }>).map((r) => ({
      id: r.id,
      title: r.title,
      source: r.source,
      sourceUrl: r.source_url,
      category: r.category as KnowledgeCategory,
      documentVersion: r.document_version,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async insertKnowledgeChunks(chunks: KnowledgeChunkRecord[]): Promise<void> {
    const db = this.ensureKnowledgeSchema();
    db.exec("BEGIN");
    try {
      const del = db.prepare(`DELETE FROM knowledge_chunks WHERE document_id = ?`);
      const ins = db.prepare(
        `INSERT INTO knowledge_chunks (id, document_id, content, section, page_number, metadata, embedding, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const chunk of chunks) {
        del.run(chunk.documentId);
        ins.run(
          chunk.id,
          chunk.documentId,
          chunk.content,
          chunk.section,
          chunk.pageNumber ?? null,
          JSON.stringify(chunk.metadata),
          chunk.embedding ? JSON.stringify(chunk.embedding) : null,
          chunk.createdAt,
        );
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  async searchKnowledgeChunks(
    query: string,
    options: { category?: string; limit?: number; queryEmbedding?: number[] | null } = {},
  ): Promise<KnowledgeSearchHit[]> {
    const db = this.ensureKnowledgeSchema();
    const limit = options.limit ?? 5;
    const rows = db
      .prepare(
        `SELECT c.id, c.document_id, c.content, c.section, c.page_number, c.metadata, c.embedding, c.created_at
         FROM knowledge_chunks c
         JOIN knowledge_documents d ON d.id = c.document_id
         WHERE (? = '' OR d.category = ?)
         ORDER BY c.content LIKE '%' || ? || '%' DESC
         LIMIT ?`,
      )
      .all(options.category ?? "", options.category ?? "", query, limit * 3) as Array<{
      id: string;
      document_id: string;
      content: string;
      section: string;
      page_number: number | null;
      metadata: string;
      embedding: string | null;
      created_at: string;
    }>;

    const queryTokens = new Set(
      query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean).filter((t) => !STOPWORDS.has(t)),
    );
    const scored = rows
      .map((r) => {
        let score = 0;
        if (r.embedding && options.queryEmbedding) {
          score = cosineSimilarity(options.queryEmbedding, JSON.parse(r.embedding) as number[]);
        } else {
          const contentTokens = new Set(
            r.content.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean).filter((t) => !STOPWORDS.has(t)),
          );
          const overlap = [...queryTokens].filter((t) => contentTokens.has(t)).length;
          score = queryTokens.size > 0 ? overlap / Math.sqrt(queryTokens.size) : 0;
        }
        return { r, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(({ r, score }) => ({
      chunk: {
        id: r.id,
        documentId: r.document_id,
        content: r.content,
        section: r.section,
        pageNumber: r.page_number,
        metadata: JSON.parse(r.metadata) as Record<string, string>,
        embedding: r.embedding ? (JSON.parse(r.embedding) as number[]) : null,
        createdAt: r.created_at,
      },
      score,
    }));
  }
}