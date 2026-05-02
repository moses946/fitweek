/**
 * Suggestion filter — determines which garments are eligible to be suggested
 * for a given day in the Weekly Planner.
 *
 * Issue 3 TDD — Tests 6-11 (status/skip/delete filtering)
 * Issue 4 TDD — Tests 12-13 (interleaving + sort by recency)
 */

import { DailyForecast } from "./weather";
import { isWeatherAppropriate } from "./weatherFilter";
import { Garment } from "./types";
import { toISODate } from "./garmentStatus";

// ── Core predicates ───────────────────────────────────────────────────────────

export function isSkippedToday(garment: Garment, today?: Date): boolean {
  if (!garment.lastSkippedAt) return false;
  return garment.lastSkippedAt === toISODate(today);
}

export function isSkippedUntil(garment: Garment, today?: Date): boolean {
  if (!garment.skipUntil) return false;
  return garment.skipUntil >= toISODate(today);
}

/**
 * Returns true if the garment should appear in outfit suggestions
 * (ignoring weather — use isSuggestableWithWeather for full check).
 */
export function isSuggestable(garment: Garment, today?: Date): boolean {
  if (garment.status !== "clean") return false;
  if (garment.deletedAt !== null) return false;
  if (isSkippedToday(garment, today)) return false;
  if (isSkippedUntil(garment, today)) return false;
  return true;
}

export function filterSuggestable(garments: Garment[], today?: Date): Garment[] {
  return garments.filter((g) => isSuggestable(g, today));
}

// ── Weather-aware filter ──────────────────────────────────────────────────────

/**
 * Full suggestion filter: status + skip + delete + weather-appropriateness.
 * When forecast is null, weather filter is skipped (all categories pass).
 */
export function filterSuggestableWithWeather(
  garments: Garment[],
  forecast: DailyForecast | null,
  today?: Date,
): Garment[] {
  return garments.filter(
    (g) => isSuggestable(g, today) && isWeatherAppropriate(g.category, forecast),
  );
}

// ── Sorting + interleaving ────────────────────────────────────────────────────

/**
 * Sort garments by createdAt descending — newer items surface first.
 * Issue 4 Test 13.
 */
export function sortByRecency(garments: Garment[]): Garment[] {
  return [...garments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Interleave garments across categories in a round-robin fashion.
 * Within each category, items are sorted by createdAt DESC (newest first).
 * Issue 4 Test 12.
 *
 * Example input:  [top-A, top-B, bottom-A, bottom-B]
 * Example output: [top-B, bottom-B, top-A, bottom-A]  (B = newer)
 */
export function interleaveByCategory(garments: Garment[]): Garment[] {
  // Group by category, preserving encounter order of categories
  const groups = new Map<string, Garment[]>();
  for (const g of garments) {
    const list = groups.get(g.category) ?? [];
    list.push(g);
    groups.set(g.category, list);
  }

  // Sort each group newest-first
  for (const [cat, list] of groups) {
    groups.set(cat, sortByRecency(list));
  }

  // Round-robin interleave
  const keys = Array.from(groups.keys());
  const result: Garment[] = [];
  let round = 0;
  let anyLeft = true;
  while (anyLeft) {
    anyLeft = false;
    for (const key of keys) {
      const list = groups.get(key)!;
      if (round < list.length) {
        result.push(list[round]!);
        anyLeft = true;
      }
    }
    round++;
  }
  return result;
}

/**
 * Full suggestion pipeline for the swipe deck:
 *  1. Filter by status + skip + delete + weather
 *  2. Sort newest-first within category
 *  3. Interleave categories round-robin
 */
export function buildSuggestionDeck(
  garments: Garment[],
  forecast: DailyForecast | null,
  today?: Date,
): Garment[] {
  const filtered = filterSuggestableWithWeather(garments, forecast, today);
  return interleaveByCategory(filtered);
}
