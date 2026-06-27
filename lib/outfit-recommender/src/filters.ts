import type { DailyForecast, Garment, GarmentCategory } from "./types.js";
import { toISODate } from "./date.js";

export const ALL_CATEGORIES: GarmentCategory[] = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "accessories",
  "other",
];

const COLD_CONDITIONS = new Set(["rainy", "snowy", "thunderstorm", "windy"]);

export function isSkippedToday(garment: Garment, today?: Date): boolean {
  if (!garment.lastSkippedAt) return false;
  return garment.lastSkippedAt === toISODate(today);
}

export function isSkippedUntil(garment: Garment, today?: Date): boolean {
  if (!garment.skipUntil) return false;
  return garment.skipUntil >= toISODate(today);
}

export function isSuggestable(garment: Garment, today?: Date): boolean {
  if (garment.status !== "active") return false;
  if (garment.deletedAt !== null) return false;
  if (isSkippedToday(garment, today)) return false;
  if (isSkippedUntil(garment, today)) return false;
  return true;
}

export function filterSuggestable(garments: Garment[], today?: Date): Garment[] {
  return garments.filter((g) => isSuggestable(g, today));
}

export function getSuggestableCategories(
  forecast: DailyForecast | null,
): GarmentCategory[] {
  if (!forecast) return [...ALL_CATEGORIES];

  const { tempMax, condition } = forecast;
  const isCold = tempMax < 20;
  const isWet = COLD_CONDITIONS.has(condition);

  return ALL_CATEGORIES.filter((cat) => {
    if (cat === "outerwear") return isCold;
    if (cat === "dresses") return tempMax >= 15 && !isWet;
    return true;
  });
}

export function isWeatherAppropriate(
  category: GarmentCategory,
  forecast: DailyForecast | null,
): boolean {
  return getSuggestableCategories(forecast).includes(category);
}

export function filterSuggestableWithWeather(
  garments: Garment[],
  forecast: DailyForecast | null,
  today?: Date,
): Garment[] {
  return garments.filter(
    (g) => isSuggestable(g, today) && isWeatherAppropriate(g.category, forecast),
  );
}
