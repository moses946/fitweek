import type {
  DailyForecast,
  EngineConfig,
  Garment,
  GarmentCategory,
  ScoredOutfit,
} from "./types.js";
import {
  scoreAndRank,
  topByCategory,
} from "./garmentScorer.js";
import type { ScoredGarment } from "./types.js";
import { scoreOutfit } from "./outfitScorer.js";
import {
  OUTFIT_TEMPLATES,
  shouldIncludeOuterwear,
} from "./outfitTemplates.js";

const DEFAULT_TOP_PER_SLOT = 3;
const DEFAULT_MAX_CANDIDATES = 8;

function uniqueGarments(garments: Garment[]): Garment[] {
  const seen = new Set<string>();
  return garments.filter((g) => {
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });
}

function toScoredOutfit(
  garments: Garment[],
  scored: ScoredGarment[],
  forecast: DailyForecast | null,
): ScoredOutfit {
  const byId = new Map(scored.map((s) => [s.garment.id, s]));
  const scoredGarments = garments.map(
    (g) => byId.get(g.id) ?? { garment: g, score: 0, breakdown: {
      recency: 0, weatherFit: 0, freshness: 0, variety: 0, tagFit: 0, colorNeutral: 0,
    }},
  );
  const { score, breakdown } = scoreOutfit(scoredGarments, forecast);
  return { garments: uniqueGarments(garments), score, breakdown };
}

function combineOptional(
  base: Garment[],
  optionalLists: Garment[][],
  includeOuterwear: boolean,
): Garment[][] {
  const results: Garment[][] = [base];

  for (const list of optionalLists) {
    const next: Garment[][] = [];
    for (const outfit of results) {
      next.push(outfit);
      for (const item of list) {
        if (item.category === "outerwear" && !includeOuterwear) continue;
        if (outfit.some((g) => g.id === item.id)) continue;
        next.push([...outfit, item]);
      }
    }
    results.length = 0;
    results.push(...next);
  }

  return results;
}

export function generateOutfitCandidates(
  eligible: Garment[],
  forecast: DailyForecast | null,
  plannedIds: Set<string>,
  today: Date,
  config?: EngineConfig,
): ScoredOutfit[] {
  const topPerSlot = config?.topPerSlot ?? DEFAULT_TOP_PER_SLOT;
  const maxCandidates = config?.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  const scored = scoreAndRank(eligible, forecast, plannedIds, today, config);
  const includeOuterwear = shouldIncludeOuterwear(forecast?.tempMax);

  const candidates: ScoredOutfit[] = [];

  for (const template of OUTFIT_TEMPLATES) {
    const requiredPools: Garment[][] = template.required.map((cat) =>
      topByCategory(scored, cat, topPerSlot).map((s) => s.garment),
    );

    if (requiredPools.some((pool) => pool.length === 0)) continue;

    const requiredCombos: Garment[][] = requiredPools.reduce<Garment[][]>(
      (acc, pool) => {
        if (acc.length === 0) return pool.map((g) => [g]);
        const next: Garment[][] = [];
        for (const combo of acc) {
          for (const g of pool) {
            if (combo.some((c) => c.id === g.id)) continue;
            next.push([...combo, g]);
          }
        }
        return next;
      },
      [],
    );

    const shoes = topByCategory(scored, "shoes", topPerSlot).map((s) => s.garment);
    const outerwear = topByCategory(scored, "outerwear", topPerSlot).map(
      (s) => s.garment,
    );

    for (const required of requiredCombos) {
      const combos = combineOptional(
        required,
        [shoes, outerwear],
        includeOuterwear,
      );
      for (const garments of combos) {
        candidates.push(toScoredOutfit(garments, scored, forecast));
      }
    }
  }

  const seen = new Set<string>();
  return candidates
    .sort((a, b) => b.score - a.score)
    .filter((c) => {
      const key = c.garments
        .map((g) => g.id)
        .sort()
        .join(",");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxCandidates);
}

export function pickBestOutfit(
  eligible: Garment[],
  forecast: DailyForecast | null,
  plannedIds: Set<string>,
  today: Date,
  config?: EngineConfig,
): ScoredOutfit | null {
  const candidates = generateOutfitCandidates(
    eligible,
    forecast,
    plannedIds,
    today,
    config,
  );
  return candidates[0] ?? null;
}

export function outfitOverlapsPlanned(
  outfit: Garment[],
  usedIds: Set<string>,
): boolean {
  return outfit.some((g) => usedIds.has(g.id));
}
