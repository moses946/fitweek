/**
 * Client-side re-exports of shared recommendation filters.
 * Scoring and outfit assembly run server-side via /api/outfit/*.
 */

export {
  isSuggestable,
  isSkippedToday,
  isSkippedUntil,
  filterSuggestable,
  filterSuggestableWithWeather,
  isWeatherAppropriate,
  getSuggestableCategories,
  ALL_CATEGORIES,
} from "@workspace/outfit-recommender";

import type { Garment } from "./types";
import type { DailyForecast } from "./weather";
import { filterSuggestableWithWeather } from "@workspace/outfit-recommender";
import { scoreAndRank } from "./suggestionScorer";

/** @deprecated Use POST /api/outfit/deck for ranked swipe decks. */
export function sortByRecency(garments: Garment[]): Garment[] {
  return [...garments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** @deprecated Use POST /api/outfit/deck for ranked swipe decks. */
export function interleaveByCategory(garments: Garment[]): Garment[] {
  const groups = new Map<string, Garment[]>();
  for (const g of garments) {
    const list = groups.get(g.category) ?? [];
    list.push(g);
    groups.set(g.category, list);
  }
  for (const [cat, list] of groups) {
    groups.set(cat, sortByRecency(list));
  }
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
 * @deprecated Prefer POST /api/outfit/deck. Falls back to scored ranking locally.
 */
export function buildSuggestionDeck(
  garments: Garment[],
  forecast: DailyForecast | null,
  today?: Date,
): Garment[] {
  const filtered = filterSuggestableWithWeather(garments, forecast, today);
  const ranked = scoreAndRank(filtered, forecast, new Set(), today ?? new Date());
  return ranked.map((s) => s.garment);
}
