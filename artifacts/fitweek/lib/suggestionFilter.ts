/**
 * Suggestion filter — determines which garments appear in outfit suggestions.
 *
 * Issue 3 TDD — Tests 6-11 (status, deleted, skip logic)
 * Issue 4 TDD — Tests 12-13 (interleaving by category, sort by recency)
 */

import { Garment } from "./types";
import { toISODate } from "./garmentStatus";
import { DailyForecast } from "./weather";
import { isCategoryWeatherAppropriate } from "./weatherFilter";

// ─── Skip predicates ──────────────────────────────────────────────────────────

export function isSkippedToday(garment: Garment, today?: Date): boolean {
  if (!garment.lastSkippedAt) return false;
  return garment.lastSkippedAt === toISODate(today);
}

export function isSkippedUntil(garment: Garment, today?: Date): boolean {
  if (!garment.skipUntil) return false;
  return garment.skipUntil >= toISODate(today);
}

/**
 * Returns true if the garment should appear in outfit suggestions.
 * Excluded when: not clean, soft-deleted, skipped today, or in a skip window.
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

// ─── Ordering: interleave by category, sort by recency ───────────────────────

/**
 * Test 12: Interleaves garments by category (top, trousers, top, trousers…)
 * Test 13: Within each category, newer garments (createdAt DESC) surface first.
 */
export function interleaveByCategory(garments: Garment[]): Garment[] {
  // 1. Group by category
  const groups = new Map<string, Garment[]>();
  for (const g of garments) {
    const bucket = groups.get(g.category) ?? [];
    bucket.push(g);
    groups.set(g.category, bucket);
  }

  // 2. Sort each group by createdAt DESC (newer first)
  for (const [cat, items] of groups) {
    groups.set(
      cat,
      [...items].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    );
  }

  // 3. Round-robin interleave: one from each category per pass
  const result: Garment[] = [];
  const keys = Array.from(groups.keys());
  const cursors: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));

  let made_progress = true;
  while (made_progress) {
    made_progress = false;
    for (const cat of keys) {
      const items = groups.get(cat)!;
      const idx = cursors[cat]!;
      if (idx < items.length) {
        result.push(items[idx]!);
        cursors[cat] = idx + 1;
        made_progress = true;
      }
    }
  }

  return result;
}

/**
 * Full suggestion pipeline: filter → weather check → interleave + sort.
 * Pass forecast=null to skip weather filtering (all categories allowed).
 */
export function filterSuggestableWithWeather(
  garments: Garment[],
  forecast: DailyForecast | null,
  today?: Date,
): Garment[] {
  const suggestable = filterSuggestable(garments, today);
  const weatherFiltered = suggestable.filter((g) =>
    isCategoryWeatherAppropriate(g.category, forecast),
  );
  return interleaveByCategory(weatherFiltered);
}
