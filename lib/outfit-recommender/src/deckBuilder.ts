import type { DailyForecast, EngineConfig, Garment } from "./types.js";
import { filterSuggestableWithWeather } from "./filters.js";
import { scoreAndRank } from "./garmentScorer.js";

export function buildSwipeDeckIds(
  eligible: Garment[],
  forecast: DailyForecast | null,
  plannedIds: Set<string>,
  today: Date,
  config?: EngineConfig,
  heroId?: string,
): string[] {
  const ranked = scoreAndRank(eligible, forecast, plannedIds, today, config);
  const ids = ranked.map((s) => s.garment.id);

  if (heroId && ids.includes(heroId)) {
    return [heroId, ...ids.filter((id) => id !== heroId)];
  }

  return ids;
}

export function buildSwipeDeck(
  garments: Garment[],
  forecast: DailyForecast | null,
  plannedIds: Set<string>,
  today: Date,
  config?: EngineConfig,
  heroId?: string,
): Garment[] {
  const enableWeather = config?.enableWeatherFiltering !== false;
  const activeForecast = enableWeather ? forecast : null;
  const eligible = filterSuggestableWithWeather(garments, activeForecast, today);
  const ids = buildSwipeDeckIds(
    eligible,
    activeForecast,
    plannedIds,
    today,
    config,
    heroId,
  );
  const byId = new Map(garments.map((g) => [g.id, g]));
  return ids.map((id) => byId.get(id)).filter((g): g is Garment => !!g);
}
