/**
 * Weather-aware garment category filter.
 *
 * Issue 4 TDD — Tests 4-6:
 *   Test 4: 32°C sunny → 'outerwear' excluded; 'shoes', 'tops', etc. included
 *   Test 5: 5°C rainy  → 'dresses' excluded; 'outerwear' included
 *   Test 6: null forecast → all categories returned (no filtering)
 */

import { DailyForecast } from "./weather";
import { GarmentCategory } from "./types";

export const ALL_CATEGORIES: GarmentCategory[] = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "accessories",
  "other",
];

/** Weather conditions that are "cold-friendly" (outerwear recommended). */
const COLD_CONDITIONS = new Set(["rainy", "snowy", "thunderstorm", "windy"]);

/**
 * Returns the set of categories that are weather-appropriate for the given
 * daily forecast. When forecast is null (weather unavailable), returns all.
 *
 * Rules:
 *  - outerwear : include when tempMax < 20 °C
 *  - dresses   : include when tempMax ≥ 15 °C AND condition is not cold/wet
 *  - all others: always included
 */
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

/**
 * Returns true when the garment's category is weather-appropriate.
 * Always returns true when forecast is null (no filtering).
 */
export function isWeatherAppropriate(
  category: GarmentCategory,
  forecast: DailyForecast | null,
): boolean {
  return getSuggestableCategories(forecast).includes(category);
}
