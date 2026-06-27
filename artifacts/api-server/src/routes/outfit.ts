import { Router } from "express";
import {
  recommendForWeekAsRecord,
  buildSwipeDeckIds,
  filterSuggestableWithWeather,
  parseISODate,
  type Garment,
  type DailyForecast,
} from "@workspace/outfit-recommender";

const router = Router();

/**
 * POST /api/outfit/suggest
 *
 * Body: { dates: string[], garments: Garment[], forecasts: DailyForecast[] }
 * Returns: { suggestions: Record<string, string[]>, meta: Record<string, DayRecommendation> }
 */
router.post("/outfit/suggest", (req, res) => {
  const { dates, garments, forecasts } = req.body as {
    dates?: string[];
    garments?: Garment[];
    forecasts?: DailyForecast[];
  };

  if (!Array.isArray(dates) || !Array.isArray(garments)) {
    return res.status(400).json({ error: "dates and garments arrays are required" });
  }

  const forecastByDate = new Map<string, DailyForecast>(
    (forecasts ?? []).map((f) => [f.date, f]),
  );

  const { suggestions, meta } = recommendForWeekAsRecord({
    dates,
    garments,
    forecasts: forecastByDate,
  });

  return res.json({ suggestions, meta });
});

/**
 * POST /api/outfit/deck
 *
 * Body: { date, garments, forecast?, plannedGarmentIds? }
 * Returns: { deck: string[] }
 */
router.post("/outfit/deck", (req, res) => {
  const { date, garments, forecast, plannedGarmentIds } = req.body as {
    date?: string;
    garments?: Garment[];
    forecast?: DailyForecast | null;
    plannedGarmentIds?: string[];
  };

  if (!date || !Array.isArray(garments)) {
    return res.status(400).json({ error: "date and garments are required" });
  }

  const targetDate = parseISODate(date);
  const eligible = filterSuggestableWithWeather(
    garments,
    forecast ?? null,
    targetDate,
  );
  const plannedIds = new Set(plannedGarmentIds ?? []);
  const deck = buildSwipeDeckIds(
    eligible,
    forecast ?? null,
    plannedIds,
    targetDate,
  );

  return res.json({ deck });
});

export default router;
