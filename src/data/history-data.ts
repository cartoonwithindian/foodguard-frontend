import type { ProductCategory } from "@/data/product-display";
import type { AssessmentLevel, ProductAnalysisResult } from "@/data/analysis-data";

/**
 * Scan-history view models and pure filter helpers.
 *
 * Types only plus list operations — no records live here. The items rendered
 * by the history screen come from `/api/history` (JWT sessions) or the user's
 * Firestore history (Firebase sessions).
 */

export type HistoryItem = {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  barcode: string;
  scannedAt: string;
  assessment: AssessmentLevel;
  score: number;
  analysis: ProductAnalysisResult;
};

export type HistoryFilter = {
  assessment: "all" | AssessmentLevel;
  category: "all" | ProductCategory;
  dateRange: "all" | "recent" | "older";
};

export function searchHistory(
  items: HistoryItem[],
  query: string,
  filters: HistoryFilter,
): HistoryItem[] {
  let filtered = [...items];

  if (query.trim()) {
    const lower = query.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.name.toLowerCase().includes(lower) ||
        item.brand.toLowerCase().includes(lower) ||
        item.category.toLowerCase().includes(lower) ||
        item.analysis.ingredients.some((ing) =>
          ing.name.toLowerCase().includes(lower),
        ),
    );
  }

  if (filters.assessment !== "all") {
    filtered = filtered.filter((item) => item.assessment === filters.assessment);
  }

  if (filters.category !== "all") {
    filtered = filtered.filter((item) => item.category === filters.category);
  }

  if (filters.dateRange === "recent") {
    filtered = filtered.filter((item) => {
      const d = new Date(item.scannedAt);
      const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 3;
    });
  } else if (filters.dateRange === "older") {
    filtered = filtered.filter((item) => {
      const d = new Date(item.scannedAt);
      const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays > 3;
    });
  }

  return filtered.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
}

export function getHistoryCounts(items: HistoryItem[]) {
  return {
    high: items.filter((i) => i.assessment === "high").length,
    moderate: items.filter((i) => i.assessment === "moderate").length,
    low: items.filter((i) => i.assessment === "low").length,
    total: items.length,
  };
}

export const CATEGORIES = [
  { value: "all" as const, label: "All Categories" },
  { value: "food" as const, label: "Food" },
  { value: "cosmetics" as const, label: "Cosmetics" },
  { value: "personal_care" as const, label: "Personal Care" },
  { value: "household" as const, label: "Household" },
];

export const DATE_RANGES = [
  { value: "all" as const, label: "All Time" },
  { value: "recent" as const, label: "Last 3 Days" },
  { value: "older" as const, label: "Older" },
];
