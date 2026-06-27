import type { Garment, GarmentCategory } from "./types.js";

export type OutfitTemplateId = "dress" | "top_bottom";

export interface OutfitTemplate {
  id: OutfitTemplateId;
  required: GarmentCategory[];
  optional: GarmentCategory[];
}

export const OUTFIT_TEMPLATES: OutfitTemplate[] = [
  {
    id: "dress",
    required: ["dresses"],
    optional: ["shoes", "outerwear"],
  },
  {
    id: "top_bottom",
    required: ["tops", "bottoms"],
    optional: ["shoes", "outerwear"],
  },
];

export function shouldIncludeOuterwear(tempMax: number | undefined): boolean {
  return tempMax !== undefined && tempMax < 20;
}

export function outfitHasDuplicateCategories(garments: Garment[]): boolean {
  const seen = new Set<GarmentCategory>();
  for (const g of garments) {
    if (seen.has(g.category)) return true;
    seen.add(g.category);
  }
  return false;
}
