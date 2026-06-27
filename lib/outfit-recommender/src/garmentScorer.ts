import type {
  DailyForecast,
  EngineConfig,
  Garment,
  GarmentCategory,
  GarmentScoreBreakdown,
  GarmentWeights,
  ScoredGarment,
} from "./types.js";

export const DEFAULT_WEIGHTS: GarmentWeights = {
  recency: 0.30,
  weatherFit: 0.30,
  freshness: 0.10,
  variety: 0.15,
  tagFit: 0.10,
  colorNeutral: 0.05,
};

export const RECENCY_FRESH_DAYS = 9;

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

const BRIGHT_COLORS = new Set([
  "red",
  "orange",
  "yellow",
  "pink",
  "purple",
  "lime",
  "magenta",
]);

export function resolveWeights(config?: EngineConfig): GarmentWeights {
  return { ...DEFAULT_WEIGHTS, ...config?.weights };
}

export function recencyScore(lastWornAt: string | null, today: Date): number {
  if (!lastWornAt) return 1.0;
  const daysSince =
    (today.getTime() - new Date(lastWornAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.min(daysSince / RECENCY_FRESH_DAYS, 1.0);
}

function tempBandScore(category: GarmentCategory, tempMax: number): number {
  if (tempMax >= 25) {
    switch (category) {
      case "tops": return 1.0;
      case "outerwear": return 0.0;
      case "dresses": return 1.0;
      case "bottoms": return 1.0;
      case "shoes": return 1.0;
      default: return 0.8;
    }
  }
  if (tempMax >= 15) {
    switch (category) {
      case "tops": return 1.0;
      case "outerwear": return 0.3;
      case "dresses": return 0.9;
      case "bottoms": return 1.0;
      case "shoes": return 1.0;
      default: return 0.8;
    }
  }
  if (tempMax >= 10) {
    switch (category) {
      case "tops": return 0.9;
      case "outerwear": return 0.8;
      case "dresses": return 0.3;
      case "bottoms": return 1.0;
      case "shoes": return 1.0;
      default: return 0.8;
    }
  }
  switch (category) {
    case "tops": return 0.7;
    case "outerwear": return 1.0;
    case "dresses": return 0.0;
    case "bottoms": return 0.9;
    case "shoes": return 1.0;
    default: return 0.8;
  }
}

export function weatherFitScore(
  category: GarmentCategory,
  forecast: DailyForecast | null,
): number {
  if (!forecast) return 0.8;

  const base = tempBandScore(category, forecast.tempMax);
  const isWet =
    forecast.condition === "rainy" || forecast.condition === "thunderstorm";

  if (isWet) {
    if (category === "outerwear") return Math.min(base + 0.2, 1.0);
    if (category === "dresses") return Math.max(base - 0.4, 0.0);
    if (category === "shoes") return Math.max(base - 0.1, 0.0);
  }

  return base;
}

export function tagFitScore(
  tags: string[],
  forecast: DailyForecast | null,
): number {
  if (!forecast) return 0.8;
  if (tags.length === 0) return 0.8;

  const normalized = tags.map((t) => t.toLowerCase());
  let score = 0.8;
  const hot = forecast.tempMax >= 25;
  const cold = forecast.tempMax < 10;
  const wet =
    forecast.condition === "rainy" || forecast.condition === "thunderstorm";

  if (normalized.some((t) => t.includes("wool") || t.includes("fleece"))) {
    if (hot) score -= 0.3;
    if (cold) score += 0.2;
  }
  if (normalized.some((t) => t.includes("linen") || t.includes("cotton"))) {
    if (hot) score += 0.15;
  }
  if (
    normalized.some(
      (t) => t.includes("rain") || t.includes("waterproof") || t.includes("gore"),
    )
  ) {
    if (wet) score += 0.3;
  }

  return Math.min(Math.max(score, 0), 1);
}

export function colorNeutralScore(color: string): number {
  const c = color.toLowerCase().trim();
  if (!c) return 0.5;
  if (NEUTRAL_COLORS.has(c)) return 1.0;
  if ([...NEUTRAL_COLORS].some((n) => c.includes(n))) return 0.85;
  return 0.5;
}

export function isBrightColor(color: string): boolean {
  const c = color.toLowerCase().trim();
  return BRIGHT_COLORS.has(c) || [...BRIGHT_COLORS].some((b) => c.includes(b));
}

export function freshnessScore(wearCount: number): number {
  return wearCount === 0 ? 1.0 : 0.0;
}

export function varietyScore(garmentId: string, plannedIds: Set<string>): number {
  return plannedIds.has(garmentId) ? 0.0 : 1.0;
}

export function compositeScore(
  garment: Garment,
  forecast: DailyForecast | null,
  plannedIds: Set<string>,
  today: Date,
  weights: GarmentWeights = DEFAULT_WEIGHTS,
): { total: number; breakdown: GarmentScoreBreakdown } {
  const recency = recencyScore(garment.lastWornAt, today);
  const weatherFit = weatherFitScore(garment.category, forecast);
  const freshness = freshnessScore(garment.wearCount);
  const variety = varietyScore(garment.id, plannedIds);
  const tagFit = tagFitScore(garment.tags, forecast);
  const colorNeutral = colorNeutralScore(garment.color);

  const total =
    weights.recency * recency +
    weights.weatherFit * weatherFit +
    weights.freshness * freshness +
    weights.variety * variety +
    weights.tagFit * tagFit +
    weights.colorNeutral * colorNeutral;

  return {
    total,
    breakdown: { recency, weatherFit, freshness, variety, tagFit, colorNeutral },
  };
}

export function scoreAndRank(
  garments: Garment[],
  forecast: DailyForecast | null,
  plannedIds: Set<string>,
  today: Date,
  config?: EngineConfig,
): ScoredGarment[] {
  const weights = resolveWeights(config);
  return garments
    .map((g) => {
      const { total, breakdown } = compositeScore(
        g,
        forecast,
        plannedIds,
        today,
        weights,
      );
      return { garment: g, score: total, breakdown };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.garment.createdAt.localeCompare(a.garment.createdAt);
    });
}

export function topByCategory(
  scored: ScoredGarment[],
  category: GarmentCategory,
  limit: number,
): ScoredGarment[] {
  return scored.filter((s) => s.garment.category === category).slice(0, limit);
}
