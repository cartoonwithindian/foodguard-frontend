/**
 * Shared display vocabulary for products and assessments.
 *
 * These are UI constants (labels and color tokens), not data: nothing here is
 * a product record, a score, or a history entry. All product content comes
 * from the FoodGuard backend.
 */

export type ProductCategory =
  | "food"
  | "cosmetics"
  | "personal_care"
  | "household"
  | "other";

export type ConcernLevel = "high" | "moderate" | "low" | "insufficient";

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  food: "Food & Beverage",
  cosmetics: "Cosmetics & Skincare",
  personal_care: "Personal Care",
  household: "Household Products",
  other: "Other",
};

export const CONCERN_COLORS: Record<
  ConcernLevel,
  { bg: string; text: string; dot: string }
> = {
  high: { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
  moderate: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  low: { bg: "bg-green-50 dark:bg-green-950/40", text: "text-green-700 dark:text-green-400", dot: "bg-green-600" },
  insufficient: { bg: "bg-gray-50 dark:bg-gray-900/40", text: "text-gray-700 dark:text-gray-400", dot: "bg-gray-400" },
};
