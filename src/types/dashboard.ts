export type ProductCategory =
  | "food"
  | "cosmetics"
  | "personal_care"
  | "household"
  | "other";

export type ConcernLevel = "high" | "moderate" | "low";

export type ScannedProduct = {
  id: string;
  name: string;
  category: ProductCategory;
  concern: ConcernLevel;
  scannedAt: string;
  barcode?: string;
};

export type UserPreference = {
  goal: string;
  focuses: string[];
};
