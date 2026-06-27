import type { DayRecommendation, WeekRecommendInput } from "./types.js";
import { parseISODate } from "./date.js";
import { filterSuggestableWithWeather } from "./filters.js";
import {
  generateOutfitCandidates,
  outfitOverlapsPlanned,
} from "./outfitBuilder.js";
import { buildSwipeDeckIds } from "./deckBuilder.js";

function pickOutfitForDay(
  candidates: ReturnType<typeof generateOutfitCandidates>,
  usedIds: Set<string>,
  allowReuse: boolean,
): (typeof candidates)[number] | null {
  if (!allowReuse) {
    const fresh = candidates.find((c) => !outfitOverlapsPlanned(c.garments, usedIds));
    if (fresh) return fresh;
  }
  return candidates[0] ?? null;
}

function toDayRecommendation(
  outfit: NonNullable<ReturnType<typeof pickOutfitForDay>>,
  eligible: Parameters<typeof buildSwipeDeckIds>[0],
  forecast: Parameters<typeof buildSwipeDeckIds>[1],
  plannedIds: Set<string>,
  today: Date,
  config: WeekRecommendInput["config"],
): DayRecommendation {
  const outfitIds = outfit.garments.map((g) => g.id);
  const deck = buildSwipeDeckIds(
    eligible,
    forecast,
    plannedIds,
    today,
    config,
    outfitIds[0],
  );
  return {
    outfitIds,
    deck,
    score: outfit.score,
    breakdown: outfit.breakdown,
  };
}

function swapImprovementPass(
  assignments: Map<string, DayRecommendation | null>,
  candidatesByDate: Map<string, ReturnType<typeof generateOutfitCandidates>>,
): void {
  const dates = [...assignments.keys()];
  for (let i = 0; i < dates.length; i++) {
    for (let j = i + 1; j < dates.length; j++) {
      const di = dates[i]!;
      const dj = dates[j]!;
      const ai = assignments.get(di);
      const aj = assignments.get(dj);
      if (!ai || !aj) continue;

      const ci = candidatesByDate.get(di) ?? [];
      const cj = candidatesByDate.get(dj) ?? [];

      const altI = ci.find(
        (c) =>
          c.garments.map((g) => g.id).join() === aj.outfitIds.join(),
      );
      const altJ = cj.find(
        (c) =>
          c.garments.map((g) => g.id).join() === ai.outfitIds.join(),
      );

      if (!altI || !altJ) continue;

      const currentTotal = ai.score + aj.score;
      const swappedTotal = altI.score + altJ.score;
      if (swappedTotal > currentTotal + 0.001) {
        assignments.set(di, {
          ...aj,
          outfitIds: altI.garments.map((g) => g.id),
          score: altI.score,
          breakdown: altI.breakdown,
          deck: ai.deck,
        });
        assignments.set(dj, {
          ...ai,
          outfitIds: altJ.garments.map((g) => g.id),
          score: altJ.score,
          breakdown: altJ.breakdown,
          deck: aj.deck,
        });
      }
    }
  }
}

export function recommendForWeek(
  input: WeekRecommendInput,
): Map<string, DayRecommendation | null> {
  const {
    dates,
    garments,
    forecasts,
    alreadyPlanned = new Map(),
    today = new Date(),
    config,
  } = input;

  const enableWeather = config?.enableWeatherFiltering !== false;
  const usedIds = new Set<string>();
  for (const ids of alreadyPlanned.values()) {
    for (const id of ids) usedIds.add(id);
  }

  const assignments = new Map<string, DayRecommendation | null>();
  const candidatesByDate = new Map<
    string,
    ReturnType<typeof generateOutfitCandidates>
  >();

  for (const date of dates) {
    const forecast = enableWeather ? forecasts.get(date) ?? null : null;
    const targetDate = parseISODate(date);
    const eligible = filterSuggestableWithWeather(garments, forecast, targetDate);
    const candidates = generateOutfitCandidates(
      eligible,
      forecast,
      usedIds,
      today,
      config,
    );
    candidatesByDate.set(date, candidates);

    let picked = pickOutfitForDay(candidates, usedIds, false);
    if (!picked) {
      picked = pickOutfitForDay(candidates, usedIds, true);
    }

    if (!picked) {
      assignments.set(date, null);
      continue;
    }

    assignments.set(
      date,
      toDayRecommendation(picked, eligible, forecast, usedIds, today, config),
    );

    for (const g of picked.garments) {
      usedIds.add(g.id);
    }
  }

  swapImprovementPass(assignments, candidatesByDate);
  return assignments;
}
