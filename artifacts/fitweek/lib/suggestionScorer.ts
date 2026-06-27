/**
 * Suggestion Scorer — pure, I/O-free scoring functions for the v2 algorithm.
 *
 * Architecture: hard-pass / soft-rank hybrid
 *  Stage 1 (hard-pass): filterSuggestableWithWeather in suggestionFilter.ts
 *  Stage 2 (soft-rank): scoreAndRank / pickFromTiers in this file
 *
 * Four signals:
 *  - recency    (0.40): penalises recently worn items (9-day linear decay)
 *  - weatherFit (0.35): rewards category/condition alignment
 *  - freshness  (0.15): rewards never-worn items
 *  - variety    (0.10): penalises garments already assigned this week
 *
 * Category tiers (for single-item picks):
 *  Tier 1 — tops | outerwear | dresses  (hero garment)
 *  Tier 2 — bottoms                     (fallback)
 *  Tier 3 — shoes                       (last resort)
 *  Tier 4 — accessories | other         (excluded from single-item suggests)
 */

import { Garment, GarmentCategory } from "./types";
import { DailyForecast } from "./weather";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SuggestedItem {
  /** The top-pick garment for the day. */
  garment: Garment;
  /** Composite score 0–1. */
  score: number;
  /** Per-signal breakdown — useful for debugging and future "why this?" UI. */
  breakdown: {
    recency: number;
    weatherFit: number;
    freshness: number;
    variety: number;
  };
  /** Which tier the pick came from (1 = hero, 2 = bottoms, 3 = shoes). */
  tier: 1 | 2 | 3;
  /**
   * Full scored+ranked garment list for the swipe screen.
   * deck[0] === garment (the top pick is always the first card).
   * Includes garments from all tiers so the user can swipe freely.
   */
  deck: Garment[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Category tiers used for single-item selection.
 *
 * When the engine needs to return one garment per day it walks through tiers
 * in order and picks the highest-scored garment from the first non-empty tier.
 *
 * Tier 1: tops, outerwear, dresses — the "hero" piece of any outfit.
 *         Dresses are treated as Tier 1 peers because they replace a top+bottom.
 * Tier 2: bottoms — fallback when no Tier 1 item is available.
 * Tier 3: shoes — last resort.
 * Tier 4: accessories, other — excluded from single-item suggests for now.
 */
export const SUGGESTION_TIERS: GarmentCategory[][] = [
  ["tops", "outerwear", "dresses"], // Tier 1
  ["bottoms"],                      // Tier 2
  ["shoes"],                        // Tier 3
];

/** Signal weights — must sum to 1.0. */
export const WEIGHTS = {
  recency:    0.40,
  weatherFit: 0.35,
  freshness:  0.15,
  variety:    0.10,
} as const;

/**
 * Days since last wear before a garment is considered fully fresh.
 * Linear decay: score = min(daysSinceWorn / RECENCY_FRESH_DAYS, 1.0)
 */
export const RECENCY_FRESH_DAYS = 9;

// ── Signal functions ──────────────────────────────────────────────────────────

/**
 * Recency score (0.0–1.0).
 *
 * 0.0 = worn today (maximum penalty)
 * 1.0 = worn ≥ RECENCY_FRESH_DAYS days ago, or never worn
 *
 * Linear decay makes the penalty transparent and easy to tune.
 * Never-worn items (lastWornAt = null) get a perfect score of 1.0.
 */
export function recencyScore(lastWornAt: string | null, today: Date): number {
  if (!lastWornAt) return 1.0;
  const lastWorn = new Date(lastWornAt);
  const daysSince =
    (today.getTime() - lastWorn.getTime()) / (1000 * 60 * 60 * 24);
  return Math.min(daysSince / RECENCY_FRESH_DAYS, 1.0);
}

/**
 * Base weather fit score by temperature band before wet modifier is applied.
 * @internal
 */
function tempBandScore(category: GarmentCategory, tempMax: number): number {
  if (tempMax >= 25) {
    // Hot
    switch (category) {
      case "tops":      return 1.0;
      case "outerwear": return 0.0;
      case "dresses":   return 1.0;
      case "bottoms":   return 1.0;
      case "shoes":     return 1.0;
      default:          return 0.8;
    }
  } else if (tempMax >= 15) {
    // Warm
    switch (category) {
      case "tops":      return 1.0;
      case "outerwear": return 0.3;
      case "dresses":   return 0.9;
      case "bottoms":   return 1.0;
      case "shoes":     return 1.0;
      default:          return 0.8;
    }
  } else if (tempMax >= 10) {
    // Cool
    switch (category) {
      case "tops":      return 0.9;
      case "outerwear": return 0.8;
      case "dresses":   return 0.3;
      case "bottoms":   return 1.0;
      case "shoes":     return 1.0;
      default:          return 0.8;
    }
  } else {
    // Cold (< 10°C)
    switch (category) {
      case "tops":      return 0.7;
      case "outerwear": return 1.0;
      case "dresses":   return 0.0;
      case "bottoms":   return 0.9;
      case "shoes":     return 1.0;
      default:          return 0.8;
    }
  }
}

/**
 * Category-level weather fit score (0.0–1.0).
 *
 * Applies a wet/rainy modifier on top of the temperature-band base score:
 *  - outerwear: +0.2 (capped at 1.0) — rain encourages a jacket
 *  - dresses:   -0.4 (floored at 0.0) — rain discourages dresses
 *  - shoes:     -0.1 (floored at 0.0) — mild open-toe heuristic
 *
 * When forecast is null (weather unavailable) returns 0.8 (neutral).
 *
 * NOTE (future v2 — tag modifier):
 * When Vision API tags are standardised, add a
 * `tagModifier(tags: string[], forecast: DailyForecast): number` that returns
 * a score delta based on material/cut labels (e.g. "wool" → -0.3 in hot
 * weather, "linen" → +0.1, "raincoat" → +0.3 when wet). Apply after the
 * category score: `clamp(base + tagModifier(tags, forecast), 0, 1)`.
 */
export function weatherFitScore(
  category: GarmentCategory,
  forecast: DailyForecast | null,
): number {
  if (!forecast) return 0.8;

  const base = tempBandScore(category, forecast.tempMax);
  const isWet = forecast.condition === "rainy" || forecast.condition === "thunderstorm";

  if (isWet) {
    if (category === "outerwear") return Math.min(base + 0.2, 1.0);
    if (category === "dresses")   return Math.max(base - 0.4, 0.0);
    if (category === "shoes")     return Math.max(base - 0.1, 0.0);
  }

  return base;
}

/**
 * Freshness score (0.0 or 1.0).
 *
 * 1.0 for never-worn items (wearCount === 0) — rewards newly added garments.
 * 0.0 for anything worn at least once.
 *
 * Binary rather than graduated because the recency signal already handles
 * "how long ago was it worn" — freshness is specifically for untouched items.
 */
export function freshnessScore(wearCount: number): number {
  return wearCount === 0 ? 1.0 : 0.0;
}

/**
 * Variety score (0.0 or 1.0).
 *
 * 1.0 if the garment is not in plannedIds (eligible for this week).
 * 0.0 if it has already been assigned to another day this week.
 *
 * For single-day suggests pass an empty Set — variety defaults to 1.0
 * and the signal's 0.10 weight naturally flows to the other three signals.
 */
export function varietyScore(garmentId: string, plannedIds: Set<string>): number {
  return plannedIds.has(garmentId) ? 0.0 : 1.0;
}

/**
 * Composite score for a single garment.
 * Returns the weighted total plus the per-signal breakdown.
 */
export function compositeScore(
  garment: Garment,
  forecast: DailyForecast | null,
  plannedIds: Set<string>,
  today: Date,
): { total: number; breakdown: SuggestedItem["breakdown"] } {
  const recency    = recencyScore(garment.lastWornAt, today);
  const weatherFit = weatherFitScore(garment.category, forecast);
  const freshness  = freshnessScore(garment.wearCount);
  const variety    = varietyScore(garment.id, plannedIds);

  const total =
    WEIGHTS.recency    * recency +
    WEIGHTS.weatherFit * weatherFit +
    WEIGHTS.freshness  * freshness +
    WEIGHTS.variety    * variety;

  return { total, breakdown: { recency, weatherFit, freshness, variety } };
}

// ── Internal scored type ──────────────────────────────────────────────────────

/** Garment + computed score, used internally by the pipeline. */
interface ScoredGarment {
  garment: Garment;
  score: number;
  breakdown: SuggestedItem["breakdown"];
}

// ── Ranking ───────────────────────────────────────────────────────────────────

/**
 * Score every garment and sort best → worst.
 * Tie-break: `createdAt` DESC (newer garment wins) — consistent with
 * the existing `sortByRecency` behaviour in suggestionFilter.ts.
 *
 * Exported for unit-testing the full scored output.
 */
export function scoreAndRank(
  garments: Garment[],
  forecast: DailyForecast | null,
  plannedIds: Set<string>,
  today: Date,
): ScoredGarment[] {
  return garments
    .map((g) => {
      const { total, breakdown } = compositeScore(g, forecast, plannedIds, today);
      return { garment: g, score: total, breakdown };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tie-break: newest createdAt wins
      return b.garment.createdAt.localeCompare(a.garment.createdAt);
    });
}

/**
 * Score and rank garments, returning only the ordered `Garment[]`.
 * Used to populate the swipe deck (scores not needed by the UI).
 */
export function rankGarments(
  garments: Garment[],
  forecast: DailyForecast | null,
  plannedIds: Set<string>,
  today: Date,
): Garment[] {
  return scoreAndRank(garments, forecast, plannedIds, today).map((s) => s.garment);
}

// ── Tier pick ─────────────────────────────────────────────────────────────────

/**
 * Pick the single best garment from the highest non-empty tier.
 *
 * Walks SUGGESTION_TIERS in order (Tier 1 → Tier 2 → Tier 3).
 * For each tier it finds the first item in the scored list whose category
 * belongs to that tier — because the list is already sorted best→worst,
 * the first match is the best available pick for that tier.
 *
 * Falls through to the next tier if the current one is empty.
 * Returns null only if all tiers have zero eligible garments.
 *
 * @param scored - Full output of scoreAndRank (all categories, best→worst)
 */
export function pickFromTiers(scored: ScoredGarment[]): SuggestedItem | null {
  for (let tierIdx = 0; tierIdx < SUGGESTION_TIERS.length; tierIdx++) {
    const tierCategories = SUGGESTION_TIERS[tierIdx]!;
    const tierNum = (tierIdx + 1) as 1 | 2 | 3;

    const best = scored.find((s) =>
      tierCategories.includes(s.garment.category),
    );

    if (best) {
      // deck[0] is always the picked garment so the swipe screen opens
      // on the suggested item. Remaining cards keep their scored order.
      const deck = [
        best.garment,
        ...scored.filter((s) => s.garment.id !== best.garment.id).map((s) => s.garment),
      ];

      return {
        garment:   best.garment,
        score:     best.score,
        breakdown: best.breakdown,
        tier:      tierNum,
        deck,
      };
    }
  }

  return null; // Empty wardrobe or all garments filtered out
}
