import type {
  DailyForecast,
  Garment,
  OutfitBreakdown,
  OutfitCohesionBreakdown,
  ScoredGarment,
} from "./types.js";
import { isBrightColor } from "./garmentScorer.js";
import { outfitHasDuplicateCategories } from "./outfitTemplates.js";

const NEUTRAL_COLORS = new Set([
  "black",
  "white",
  "grey",
  "gray",
  "navy",
  "beige",
  "cream",
  "tan",
  "brown",
  "charcoal",
]);

function isNeutral(color: string): boolean {
  const c = color.toLowerCase().trim();
  if (NEUTRAL_COLORS.has(c)) return true;
  return [...NEUTRAL_COLORS].some((n) => c.includes(n));
}

function averageGarmentBreakdown(
  scored: ScoredGarment[],
): OutfitBreakdown["garments"] {
  if (scored.length === 0) {
    return {
      recency: 0,
      weatherFit: 0,
      freshness: 0,
      variety: 0,
      tagFit: 0,
      colorNeutral: 0,
    };
  }
  const sum = scored.reduce(
    (acc, s) => ({
      recency: acc.recency + s.breakdown.recency,
      weatherFit: acc.weatherFit + s.breakdown.weatherFit,
      freshness: acc.freshness + s.breakdown.freshness,
      variety: acc.variety + s.breakdown.variety,
      tagFit: acc.tagFit + s.breakdown.tagFit,
      colorNeutral: acc.colorNeutral + s.breakdown.colorNeutral,
    }),
    {
      recency: 0,
      weatherFit: 0,
      freshness: 0,
      variety: 0,
      tagFit: 0,
      colorNeutral: 0,
    },
  );
  const n = scored.length;
  return {
    recency: sum.recency / n,
    weatherFit: sum.weatherFit / n,
    freshness: sum.freshness / n,
    variety: sum.variety / n,
    tagFit: sum.tagFit / n,
    colorNeutral: sum.colorNeutral / n,
  };
}

function completenessScore(garments: Garment[]): number {
  const cats = new Set(garments.map((g) => g.category));
  if (cats.has("dresses")) return 1.0;
  if (cats.has("tops") && cats.has("bottoms")) return 1.0;
  return 0.4;
}

function outerwearFitScore(
  garments: Garment[],
  forecast: DailyForecast | null,
): number {
  const hasOuterwear = garments.some((g) => g.category === "outerwear");
  const tempMax = forecast?.tempMax ?? 18;

  if (tempMax < 12 && hasOuterwear) return 1.0;
  if (tempMax < 12 && !hasOuterwear) return 0.6;
  if (tempMax >= 25 && hasOuterwear) return 0.2;
  return 0.85;
}

function colorHarmonyScore(garments: Garment[]): number {
  const colors = garments.map((g) => g.color.toLowerCase().trim()).filter(Boolean);
  if (colors.length <= 1) return 0.9;

  const allNeutral = colors.every(isNeutral);
  if (allNeutral) return 1.0;

  const unique = new Set(colors);
  if (unique.size === 1) return 0.75;

  const brights = garments.filter((g) => isBrightColor(g.color));
  if (brights.length >= 2) {
    const brightColors = new Set(brights.map((g) => g.color.toLowerCase()));
    if (brightColors.size >= 2) return 0.5;
  }

  return 0.8;
}

function categoryCoverageScore(garments: Garment[]): number {
  return outfitHasDuplicateCategories(garments) ? 0.3 : 1.0;
}

function missingShoesPenalty(garments: Garment[]): number {
  const hasShoes = garments.some((g) => g.category === "shoes");
  return hasShoes ? 0 : 0.05;
}

export function scoreOutfitCohesion(
  garments: Garment[],
  forecast: DailyForecast | null,
): OutfitCohesionBreakdown {
  return {
    completeness: completenessScore(garments),
    outerwearFit: outerwearFitScore(garments, forecast),
    colorHarmony: colorHarmonyScore(garments),
    categoryCoverage: categoryCoverageScore(garments),
  };
}

export function scoreOutfit(
  scoredGarments: ScoredGarment[],
  forecast: DailyForecast | null,
): { score: number; breakdown: OutfitBreakdown } {
  const garments = scoredGarments.map((s) => s.garment);
  const avgGarment = averageGarmentBreakdown(scoredGarments);
  const cohesion = scoreOutfitCohesion(garments, forecast);

  const cohesionAvg =
    (cohesion.completeness +
      cohesion.outerwearFit +
      cohesion.colorHarmony +
      cohesion.categoryCoverage) /
    4;

  const garmentAvg =
    (avgGarment.recency +
      avgGarment.weatherFit +
      avgGarment.freshness +
      avgGarment.variety +
      avgGarment.tagFit +
      avgGarment.colorNeutral) /
    6;

  const score = Math.max(
    0,
    Math.min(1, garmentAvg * 0.75 + cohesionAvg * 0.25 - missingShoesPenalty(garments)),
  );

  return {
    score,
    breakdown: { garments: avgGarment, cohesion },
  };
}
