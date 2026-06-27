import type {
  DayRecommendation,
  RecommendInput,
  WeekRecommendInput,
} from "./types.js";
import { parseISODate } from "./date.js";
import { filterSuggestableWithWeather } from "./filters.js";
import { pickBestOutfit } from "./outfitBuilder.js";
import { buildSwipeDeckIds } from "./deckBuilder.js";
import { recommendForWeek } from "./weekPlanner.js";

export type {
  Garment,
  GarmentCategory,
  GarmentStatus,
  DailyForecast,
  WeatherCondition,
  DayRecommendation,
  OutfitBreakdown,
  EngineConfig,
  RecommendInput,
  WeekRecommendInput,
} from "./types.js";

export { parseISODate, toISODate } from "./date.js";

export {
  isSuggestable,
  isSkippedToday,
  isSkippedUntil,
  filterSuggestable,
  filterSuggestableWithWeather,
  isWeatherAppropriate,
  getSuggestableCategories,
  ALL_CATEGORIES,
} from "./filters.js";

export {
  recencyScore,
  weatherFitScore,
  tagFitScore,
  colorNeutralScore,
  scoreAndRank,
  DEFAULT_WEIGHTS,
} from "./garmentScorer.js";

export { generateOutfitCandidates, pickBestOutfit } from "./outfitBuilder.js";
export { scoreOutfit, scoreOutfitCohesion } from "./outfitScorer.js";
export { buildSwipeDeck, buildSwipeDeckIds } from "./deckBuilder.js";

export function recommendForDay(input: RecommendInput): DayRecommendation | null {
  const {
    date,
    garments,
    forecast,
    plannedGarmentIds = [],
    today = new Date(),
    config,
  } = input;

  const enableWeather = config?.enableWeatherFiltering !== false;
  const activeForecast = enableWeather ? forecast : null;
  const targetDate = parseISODate(date);
  const plannedIds = new Set(plannedGarmentIds);

  const eligible = filterSuggestableWithWeather(
    garments,
    activeForecast,
    targetDate,
  );
  if (eligible.length === 0) return null;

  const best = pickBestOutfit(eligible, activeForecast, plannedIds, today, config);
  if (!best) return null;

  const outfitIds = best.garments.map((g) => g.id);
  const heroId = outfitIds[0];
  const deck = buildSwipeDeckIds(
    eligible,
    activeForecast,
    plannedIds,
    today,
    config,
    heroId,
  );

  return {
    outfitIds,
    deck,
    score: best.score,
    breakdown: best.breakdown,
  };
}

export { recommendForWeek };

export function recommendForWeekAsRecord(
  input: WeekRecommendInput,
): {
  suggestions: Record<string, string[]>;
  meta: Record<string, DayRecommendation>;
} {
  const result = recommendForWeek(input);
  const suggestions: Record<string, string[]> = {};
  const meta: Record<string, DayRecommendation> = {};

  for (const [date, rec] of result) {
    if (rec) {
      suggestions[date] = rec.outfitIds;
      meta[date] = rec;
    } else {
      suggestions[date] = [];
    }
  }

  return { suggestions, meta };
}
