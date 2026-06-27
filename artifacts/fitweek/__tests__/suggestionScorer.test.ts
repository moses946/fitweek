/**
 * Unit tests for suggestionScorer.ts
 *
 * All tests are pure — no I/O, no mocks, no async.
 * Signals are tested in isolation then composed.
 */

import {
  recencyScore,
  weatherFitScore,
  freshnessScore,
  varietyScore,
  compositeScore,
  scoreAndRank,
  rankGarments,
  pickFromTiers,
  RECENCY_FRESH_DAYS,
  WEIGHTS,
  SUGGESTION_TIERS,
} from "../lib/suggestionScorer";
import { Garment } from "../lib/types";
import { DailyForecast } from "../lib/weather";

// ── Test helpers ──────────────────────────────────────────────────────────────

const TODAY = new Date("2026-05-07T00:00:00Z");

/** Subtract `days` days from TODAY and return an ISO string. */
function daysAgo(days: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/** Build a minimal valid Garment for testing. */
function makeGarment(overrides: Partial<Garment> & { id: string }): Garment {
  return {
    imageUrl: "",
    category: "tops",
    color: "",
    tags: [],
    name: "Test Garment",
    status: "active",
    wearCount: 0,
    lastWornAt: null,
    lastSkippedAt: null,
    skipUntil: null,
    deletedAt: null,
    createdAt: "2026-05-01T00:00:00Z",
    aiDescription: null,
    ...overrides,
  };
}

/** Minimal DailyForecast factory. */
function makeForecast(
  overrides: Partial<DailyForecast> = {},
): DailyForecast {
  return {
    date: "2026-05-07",
    tempMin: 15,
    tempMax: 22,
    condition: "clear",
    conditionLabel: "Clear sky",
    icon: "01d",
    pop: 0,
    ...overrides,
  };
}

// ── recencyScore ──────────────────────────────────────────────────────────────

describe("recencyScore", () => {
  it("returns 1.0 for a never-worn garment (lastWornAt = null)", () => {
    expect(recencyScore(null, TODAY)).toBe(1.0);
  });

  it("returns 0.0 for a garment worn today", () => {
    expect(recencyScore(TODAY.toISOString(), TODAY)).toBeCloseTo(0.0, 5);
  });

  it("returns ~0.556 for a garment worn 5 days ago", () => {
    expect(recencyScore(daysAgo(5), TODAY)).toBeCloseTo(5 / RECENCY_FRESH_DAYS, 3);
  });

  it("returns 1.0 for a garment worn exactly RECENCY_FRESH_DAYS days ago", () => {
    expect(recencyScore(daysAgo(RECENCY_FRESH_DAYS), TODAY)).toBeCloseTo(1.0, 2);
  });

  it("caps at 1.0 for garments worn more than RECENCY_FRESH_DAYS days ago", () => {
    expect(recencyScore(daysAgo(20), TODAY)).toBe(1.0);
  });
});

// ── weatherFitScore ───────────────────────────────────────────────────────────

describe("weatherFitScore", () => {
  it("returns 0.8 (neutral) when forecast is null", () => {
    expect(weatherFitScore("tops", null)).toBe(0.8);
    expect(weatherFitScore("outerwear", null)).toBe(0.8);
    expect(weatherFitScore("dresses", null)).toBe(0.8);
  });

  it("scores outerwear 0.0 on a hot day (tempMax ≥ 25)", () => {
    const hot = makeForecast({ tempMax: 32, condition: "clear" });
    expect(weatherFitScore("outerwear", hot)).toBe(0.0);
  });

  it("scores dresses 1.0 on a hot clear day", () => {
    const hot = makeForecast({ tempMax: 30, condition: "clear" });
    expect(weatherFitScore("dresses", hot)).toBe(1.0);
  });

  it("scores tops 1.0 on a warm day (15–24°C)", () => {
    const warm = makeForecast({ tempMax: 22, condition: "clear" });
    expect(weatherFitScore("tops", warm)).toBe(1.0);
  });

  it("scores outerwear 0.8 on a cool day (10–14°C)", () => {
    const cool = makeForecast({ tempMax: 12, condition: "cloudy" });
    expect(weatherFitScore("outerwear", cool)).toBe(0.8);
  });

  it("scores outerwear 1.0 on a cold day (<10°C)", () => {
    const cold = makeForecast({ tempMax: 5, condition: "cloudy" });
    expect(weatherFitScore("outerwear", cold)).toBe(1.0);
  });

  it("scores dresses 0.0 on a cold day", () => {
    const cold = makeForecast({ tempMax: 3, condition: "cloudy" });
    expect(weatherFitScore("dresses", cold)).toBe(0.0);
  });

  describe("wet modifier", () => {
    const coldRainy = makeForecast({ tempMax: 8, condition: "rainy" });
    const warmRainy = makeForecast({ tempMax: 20, condition: "rainy" });

    it("adds +0.2 to outerwear in rain (cold rainy → caps at 1.0)", () => {
      // cold base = 1.0 → 1.0 + 0.2 → capped 1.0
      expect(weatherFitScore("outerwear", coldRainy)).toBe(1.0);
    });

    it("adds +0.2 to outerwear in rain (warm rainy base 0.3 → 0.5)", () => {
      expect(weatherFitScore("outerwear", warmRainy)).toBeCloseTo(0.5, 5);
    });

    it("subtracts 0.4 from dresses in rain (warm rainy base 0.9 → 0.5)", () => {
      expect(weatherFitScore("dresses", warmRainy)).toBeCloseTo(0.5, 5);
    });

    it("floors dresses at 0.0 in rain on a cold day (base 0.0 - 0.4 → 0.0)", () => {
      expect(weatherFitScore("dresses", coldRainy)).toBe(0.0);
    });

    it("subtracts 0.1 from shoes in rain (warm rainy base 1.0 → 0.9)", () => {
      expect(weatherFitScore("shoes", warmRainy)).toBeCloseTo(0.9, 5);
    });

    it("applies wet modifier for thunderstorm condition too", () => {
      const storm = makeForecast({ tempMax: 20, condition: "thunderstorm" });
      expect(weatherFitScore("outerwear", storm)).toBeCloseTo(0.5, 5);
    });
  });
});

// ── freshnessScore ────────────────────────────────────────────────────────────

describe("freshnessScore", () => {
  it("returns 1.0 for a never-worn garment (wearCount = 0)", () => {
    expect(freshnessScore(0)).toBe(1.0);
  });

  it("returns 0.0 for garments worn at least once", () => {
    expect(freshnessScore(1)).toBe(0.0);
    expect(freshnessScore(5)).toBe(0.0);
    expect(freshnessScore(100)).toBe(0.0);
  });
});

// ── varietyScore ──────────────────────────────────────────────────────────────

describe("varietyScore", () => {
  it("returns 1.0 when the garment is NOT in plannedIds", () => {
    expect(varietyScore("g1", new Set(["g2", "g3"]))).toBe(1.0);
    expect(varietyScore("g1", new Set())).toBe(1.0);
  });

  it("returns 0.0 when the garment IS in plannedIds", () => {
    expect(varietyScore("g1", new Set(["g1", "g2"]))).toBe(0.0);
  });
});

// ── compositeScore ────────────────────────────────────────────────────────────

describe("compositeScore", () => {
  it("scores a never-worn top on a warm clear day with no planned context near 1.0", () => {
    const g = makeGarment({ id: "g1", category: "tops", wearCount: 0, lastWornAt: null });
    const forecast = makeForecast({ tempMax: 22, condition: "clear" });
    const { total, breakdown } = compositeScore(g, forecast, new Set(), TODAY);

    // recency=1.0, weatherFit=1.0, freshness=1.0, variety=1.0 → total=1.0
    expect(total).toBeCloseTo(1.0, 5);
    expect(breakdown.recency).toBe(1.0);
    expect(breakdown.weatherFit).toBe(1.0);
    expect(breakdown.freshness).toBe(1.0);
    expect(breakdown.variety).toBe(1.0);
  });

  it("penalises a garment worn today heavily", () => {
    const g = makeGarment({
      id: "g1",
      category: "tops",
      wearCount: 3,
      lastWornAt: TODAY.toISOString(),
    });
    const { total, breakdown } = compositeScore(g, null, new Set(), TODAY);
    expect(breakdown.recency).toBeCloseTo(0.0, 5);
    expect(breakdown.freshness).toBe(0.0);
    // total = 0*0.40 + 0.8*0.35 + 0*0.15 + 1.0*0.10 = 0.28 + 0.10 = 0.38
    expect(total).toBeCloseTo(
      WEIGHTS.recency * 0 + WEIGHTS.weatherFit * 0.8 + WEIGHTS.freshness * 0 + WEIGHTS.variety * 1.0,
      5,
    );
  });

  it("applies variety penalty for a planned garment", () => {
    const g = makeGarment({ id: "g1", category: "tops", wearCount: 0, lastWornAt: null });
    const withVariety    = compositeScore(g, null, new Set(), TODAY);
    const withoutVariety = compositeScore(g, null, new Set(["g1"]), TODAY);
    expect(withVariety.total - withoutVariety.total).toBeCloseTo(WEIGHTS.variety, 5);
  });
});

// ── scoreAndRank ──────────────────────────────────────────────────────────────

describe("scoreAndRank", () => {
  it("sorts garments best → worst by composite score", () => {
    const fresh  = makeGarment({ id: "fresh",  wearCount: 0, lastWornAt: null, createdAt: "2026-05-01T00:00:00Z" });
    const recent = makeGarment({ id: "recent", wearCount: 3, lastWornAt: daysAgo(1), createdAt: "2026-05-02T00:00:00Z" });

    const ranked = scoreAndRank([recent, fresh], null, new Set(), TODAY);
    expect(ranked[0]!.garment.id).toBe("fresh");
    expect(ranked[1]!.garment.id).toBe("recent");
  });

  it("tie-breaks equal scores by createdAt DESC (newer wins)", () => {
    const older = makeGarment({ id: "older", wearCount: 0, lastWornAt: null, createdAt: "2026-04-01T00:00:00Z" });
    const newer = makeGarment({ id: "newer", wearCount: 0, lastWornAt: null, createdAt: "2026-05-01T00:00:00Z" });

    const ranked = scoreAndRank([older, newer], null, new Set(), TODAY);
    expect(ranked[0]!.garment.id).toBe("newer");
    expect(ranked[1]!.garment.id).toBe("older");
  });
});

// ── pickFromTiers ─────────────────────────────────────────────────────────────

describe("pickFromTiers", () => {
  function scoredList(garments: Garment[]) {
    return scoreAndRank(garments, null, new Set(), TODAY);
  }

  it("picks from Tier 1 when tops are available", () => {
    const top    = makeGarment({ id: "top",    category: "tops",    wearCount: 0, lastWornAt: null });
    const bottom = makeGarment({ id: "bottom", category: "bottoms", wearCount: 0, lastWornAt: null });
    const result = pickFromTiers(scoredList([bottom, top]));
    expect(result).not.toBeNull();
    expect(result!.tier).toBe(1);
    expect(result!.garment.id).toBe("top");
  });

  it("picks a dress as Tier 1 (dresses are Tier 1 peers)", () => {
    const dress  = makeGarment({ id: "dress",  category: "dresses", wearCount: 0, lastWornAt: null });
    const bottom = makeGarment({ id: "bottom", category: "bottoms", wearCount: 0, lastWornAt: null });
    const result = pickFromTiers(scoredList([bottom, dress]));
    expect(result!.tier).toBe(1);
    expect(result!.garment.id).toBe("dress");
  });

  it("falls through to Tier 2 when Tier 1 is empty", () => {
    const bottom = makeGarment({ id: "bottom", category: "bottoms", wearCount: 0, lastWornAt: null });
    const shoe   = makeGarment({ id: "shoe",   category: "shoes",   wearCount: 0, lastWornAt: null });
    const result = pickFromTiers(scoredList([bottom, shoe]));
    expect(result!.tier).toBe(2);
    expect(result!.garment.id).toBe("bottom");
  });

  it("falls through to Tier 3 (shoes) when Tier 1 and 2 are empty", () => {
    const shoe = makeGarment({ id: "shoe", category: "shoes", wearCount: 0, lastWornAt: null });
    const result = pickFromTiers(scoredList([shoe]));
    expect(result!.tier).toBe(3);
    expect(result!.garment.id).toBe("shoe");
  });

  it("returns null when the scored list is empty", () => {
    expect(pickFromTiers([])).toBeNull();
  });

  it("returns null when all garments are accessories (Tier 4, excluded)", () => {
    const acc = makeGarment({ id: "acc", category: "accessories" });
    expect(pickFromTiers(scoredList([acc]))).toBeNull();
  });

  it("sets deck[0] === the picked garment", () => {
    const top    = makeGarment({ id: "top",    category: "tops",    wearCount: 0, lastWornAt: null });
    const bottom = makeGarment({ id: "bottom", category: "bottoms", wearCount: 0, lastWornAt: null });
    const result = pickFromTiers(scoredList([bottom, top]));
    expect(result!.deck[0]!.id).toBe(result!.garment.id);
  });

  it("deck contains all garments (not just the picked tier)", () => {
    const top    = makeGarment({ id: "top",    category: "tops" });
    const bottom = makeGarment({ id: "bottom", category: "bottoms" });
    const shoe   = makeGarment({ id: "shoe",   category: "shoes" });
    const result = pickFromTiers(scoredList([top, bottom, shoe]));
    expect(result!.deck).toHaveLength(3);
  });
});
