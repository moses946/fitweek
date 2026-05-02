/**
 * Issue 4 — Weather-based category filter
 *
 * Maps garment categories to weather suitability thresholds.
 * No side effects — pure functions, fully testable.
 *
 * TDD — Tests 4-6:
 *   Test 4: 32°C sunny → 'outerwear' excluded
 *   Test 5: 5°C rainy  → 'outerwear' included, all categories available
 *   Test 6: null forecast → all categories returned (no filtering)
 */

import { GarmentCategory } from "./types";
import { DailyForecast } from "./weather";

export const ALL_CATEGORIES: GarmentCategory[] = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "accessories",
  "other",
];

/** Average temp above which outerwear is excluded from suggestions. */
export const HOT_THRESHOLD_C = 25;

/**
 * Returns the garment categories appropriate for the given day's forecast.
 * When forecast is null (weather unavailable), all categories are returned.
 */
export function getSuggestableCategories(
  forecast: DailyForecast | null,
): GarmentCategory[] {
  if (!forecast) return [...ALL_CATEGORIES];

  const avgTemp = (forecast.tempMin + forecast.tempMax) / 2;
  const excluded = new Set<GarmentCategory>();

  if (avgTemp > HOT_THRESHOLD_C) {
    excluded.add("outerwear");
  }

  return ALL_CATEGORIES.filter((c) => !excluded.has(c));
}

/**
 * Returns true if a garment with the given category is appropriate for
 * the given day's forecast.
 */
export function isCategoryWeatherAppropriate(
  category: GarmentCategory,
  forecast: DailyForecast | null,
): boolean {
  return getSuggestableCategories(forecast).includes(category);
}
