/**
 * Search-page input helpers.
 *
 * Only input classification lives here; no product records. Search results
 * come from `/api/products` via `lib/search/search-service.ts`.
 */

/** Classify free-text input so the UI can hint what the query will run as. */
export function detectInputType(
  input: string,
): "ingredient_list" | "product_name" | "ingredient" {
  const trimmed = input.trim();
  if (trimmed.includes(",")) return "ingredient_list";
  const words = trimmed.split(/\s+/);
  if (words.length > 3) return "ingredient_list";
  const commonIngredients = [
    "water", "sugar", "salt", "oil", "flour", "sodium", "citric",
    "glycerin", "fragrance", "paraben", "sulfate", "acid",
  ];
  if (commonIngredients.some((ci) => trimmed.toLowerCase().includes(ci))) {
    return "ingredient";
  }
  return "product_name";
}
