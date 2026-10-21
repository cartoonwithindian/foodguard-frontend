export type ProductCategory =
  | "food"
  | "cosmetics"
  | "personal_care"
  | "household"
  | "other";

export type NutritionField = {
  label: string;
  value: string | number;
  unit: string;
  available: boolean;
};

export type DetailedNutrition = {
  calories: NutritionField;
  totalFat: NutritionField;
  saturatedFat: NutritionField;
  transFat: NutritionField;
  cholesterol: NutritionField;
  sodium: NutritionField;
  totalCarbohydrates: NutritionField;
  dietaryFibre: NutritionField;
  totalSugars: NutritionField;
  addedSugars: NutritionField;
  protein: NutritionField;
  vitaminD: NutritionField;
  calcium: NutritionField;
  iron: NutritionField;
  potassium: NutritionField;
  salt?: NutritionField;
};

export type NutritionAttentionArea = {
  name: string;
  nutrient?: string;
  value: string;
  unit?: string;
  basis?: string;
  threshold?: number;
  reason: string;
  severity: "low" | "moderate" | "high";
  source?: string;
};

export type NutritionPositivePoint = {
  name: string;
  value: string;
  description: string;
};

export type NutritionSourceInfo = {
  sourceName: string;
  sourceType: string;
  database?: string;
  summary: string;
  url?: string;
};

export type NutritionProductDetail = {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  barcode: string;
  scanDate: string;
  servingSize: string;
  servingsPerContainer?: string;
  nutrition: DetailedNutrition;
  attentionAreas: NutritionAttentionArea[];
  positivePoints: NutritionPositivePoint[];
  context: string;
  dataQuality: "high" | "medium" | "low";
  dataQualityExplanation: string;
  source?: NutritionSourceInfo;
};

