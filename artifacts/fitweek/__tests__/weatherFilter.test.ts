/**
 * Issue 4 — TDD: weather filter + suggestion filter tests (Tests 4–13 from plan)
 *
 * Pure functions — no mocking needed.
 * Run: pnpm --filter @workspace/fitweek test
 */

import { getSuggestableCategories, ALL_CATEGORIES } from "../lib/weatherFilter";
import {
  filterSuggestableWithWeather,
  interleaveByCategory,
  sortByRecency,
  buildSuggestionDeck,
} from "../lib/suggestionFilter";
import type { DailyForecast } from "../lib/weather";
import type { Garment } from "../lib/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const hotSunny: DailyForecast = {
  date: "2026-05-02",
  tempMin: 25,
  tempMax: 32,
  condition: "clear",
  conditionLabel: "clear sky",
  icon: "01d",
  pop: 0,
};

const coldRainy: DailyForecast = {
  date: "2026-05-02",
  tempMin: 2,
  tempMax: 5,
  condition: "rainy",
  conditionLabel: "light rain",
  icon: "10d",
  pop: 0.8,
};

const mildCloudy: DailyForecast = {
  date: "2026-05-02",
  tempMin: 12,
  tempMax: 18,
  condition: "cloudy",
  conditionLabel: "overcast clouds",
  icon: "04d",
  pop: 0.1,
};

function g(overrides: Partial<Garment> & { id: string }): Garment {
  return {
    imageUri: "test://img",
    category: "tops",
    color: "Blue",
    tags: [],
    name: "Test Garment",
    status: "clean",
    wearCount: 0,
    lastWornAt: null,
    lastSkippedAt: null,
    skipUntil: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const TODAY = new Date("2026-05-02T12:00:00Z");

// ─── Test 4: Hot sunny day ────────────────────────────────────────────────────
describe("getSuggestableCategories — Test 4: 32°C sunny", () => {
  it("excludes outerwear when it is warm", () => {
    const cats = getSuggestableCategories(hotSunny);
    expect(cats).not.toContain("outerwear");
  });

  it("includes shoes (sandals equivalent)", () => {
    const cats = getSuggestableCategories(hotSunny);
    expect(cats).toContain("shoes");
  });

  it("includes tops, bottoms, dresses, accessories", () => {
    const cats = getSuggestableCategories(hotSunny);
    expect(cats).toContain("tops");
    expect(cats).toContain("bottoms");
    expect(cats).toContain("dresses");
    expect(cats).toContain("accessories");
  });
});

// ─── Test 5: Cold rainy day ───────────────────────────────────────────────────
describe("getSuggestableCategories — Test 5: 5°C rainy", () => {
  it("excludes dresses (cold + wet)", () => {
    const cats = getSuggestableCategories(coldRainy);
    expect(cats).not.toContain("dresses");
  });

  it("includes outerwear (it is cold)", () => {
    const cats = getSuggestableCategories(coldRainy);
    expect(cats).toContain("outerwear");
  });

  it("includes tops and bottoms", () => {
    const cats = getSuggestableCategories(coldRainy);
    expect(cats).toContain("tops");
    expect(cats).toContain("bottoms");
  });
});

// ─── Test 6: Weather unavailable ─────────────────────────────────────────────
describe("getSuggestableCategories — Test 6: null forecast", () => {
  it("returns all categories when forecast is null", () => {
    const cats = getSuggestableCategories(null);
    expect(cats).toHaveLength(ALL_CATEGORIES.length);
    for (const cat of ALL_CATEGORIES) {
      expect(cats).toContain(cat);
    }
  });
});

// ─── Tests 7-10: filterSuggestableWithWeather (re-verified with weather) ──────
describe("filterSuggestableWithWeather — Tests 7-10", () => {
  it("excludes non-clean garments (Test 7)", () => {
    const list = [
      g({ id: "a", status: "clean" }),
      g({ id: "b", status: "worn" }),
      g({ id: "c", status: "laundry" }),
    ];
    const result = filterSuggestableWithWeather(list, null, TODAY);
    expect(result.map((x) => x.id)).toEqual(["a"]);
  });

  it("excludes soft-deleted garments (Test 8)", () => {
    const list = [
      g({ id: "a" }),
      g({ id: "b", deletedAt: "2026-05-01T00:00:00Z" }),
    ];
    const result = filterSuggestableWithWeather(list, null, TODAY);
    expect(result.map((x) => x.id)).toEqual(["a"]);
  });

  it("excludes garment skipped today (Test 9)", () => {
    const list = [
      g({ id: "a" }),
      g({ id: "b", lastSkippedAt: "2026-05-02" }),
    ];
    const result = filterSuggestableWithWeather(list, null, TODAY);
    expect(result.map((x) => x.id)).toEqual(["a"]);
  });

  it("excludes garment in skip window (Test 10)", () => {
    const list = [
      g({ id: "a" }),
      g({ id: "b", skipUntil: "2026-05-04" }), // next Monday, still future
    ];
    const result = filterSuggestableWithWeather(list, null, TODAY);
    expect(result.map((x) => x.id)).toEqual(["a"]);
  });

  it("applies weather filter: outerwear excluded on hot day", () => {
    const list = [
      g({ id: "top", category: "tops" }),
      g({ id: "coat", category: "outerwear" }),
    ];
    const result = filterSuggestableWithWeather(list, hotSunny, TODAY);
    const ids = result.map((x) => x.id);
    expect(ids).toContain("top");
    expect(ids).not.toContain("coat");
  });

  it("applies weather filter: dresses excluded on cold rainy day", () => {
    const list = [
      g({ id: "top", category: "tops" }),
      g({ id: "dress", category: "dresses" }),
    ];
    const result = filterSuggestableWithWeather(list, coldRainy, TODAY);
    const ids = result.map((x) => x.id);
    expect(ids).toContain("top");
    expect(ids).not.toContain("dress");
  });
});

// ─── Test 12: Interleaving ────────────────────────────────────────────────────
describe("interleaveByCategory — Test 12", () => {
  it("round-robins across categories", () => {
    const list = [
      g({ id: "t1", category: "tops", createdAt: "2026-01-01T00:00:00Z" }),
      g({ id: "t2", category: "tops", createdAt: "2026-01-02T00:00:00Z" }),
      g({ id: "b1", category: "bottoms", createdAt: "2026-01-01T00:00:00Z" }),
      g({ id: "b2", category: "bottoms", createdAt: "2026-01-02T00:00:00Z" }),
    ];

    const result = interleaveByCategory(list);

    // Adjacent items should not share the same category
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i]!.category).not.toBe(result[i + 1]!.category);
    }
    expect(result).toHaveLength(4);
  });

  it("handles a single category gracefully", () => {
    const list = [
      g({ id: "t1", category: "tops", createdAt: "2026-01-01T00:00:00Z" }),
      g({ id: "t2", category: "tops", createdAt: "2026-01-02T00:00:00Z" }),
    ];
    const result = interleaveByCategory(list);
    expect(result).toHaveLength(2);
    // Newer first
    expect(result[0]!.id).toBe("t2");
    expect(result[1]!.id).toBe("t1");
  });
});

// ─── Test 13: Newer garments surface first within category ────────────────────
describe("sortByRecency — Test 13", () => {
  it("newer garments (created_at DESC) surface first", () => {
    const list = [
      g({ id: "old", createdAt: "2026-01-01T00:00:00Z" }),
      g({ id: "new", createdAt: "2026-06-01T00:00:00Z" }),
      g({ id: "mid", createdAt: "2026-03-01T00:00:00Z" }),
    ];

    const result = sortByRecency(list);
    expect(result[0]!.id).toBe("new");
    expect(result[1]!.id).toBe("mid");
    expect(result[2]!.id).toBe("old");
  });

  it("within interleaveByCategory, each category group is sorted newest-first", () => {
    const list = [
      g({ id: "t1", category: "tops", createdAt: "2026-01-01T00:00:00Z" }),
      g({ id: "t2", category: "tops", createdAt: "2026-06-01T00:00:00Z" }),
    ];
    const result = interleaveByCategory(list);
    // t2 is newer → should appear first in the tops group → position 0 in output
    expect(result[0]!.id).toBe("t2");
  });
});

// ─── buildSuggestionDeck ──────────────────────────────────────────────────────
describe("buildSuggestionDeck", () => {
  it("filters, sorts, and interleaves in one call", () => {
    const list = [
      g({ id: "t1", category: "tops", createdAt: "2026-01-01T00:00:00Z" }),
      g({ id: "t2", category: "tops", createdAt: "2026-06-01T00:00:00Z" }),
      g({ id: "b1", category: "bottoms", createdAt: "2026-01-01T00:00:00Z" }),
      g({ id: "worn", category: "tops", status: "worn" }),
      g({ id: "coat", category: "outerwear" }),
    ];

    const result = buildSuggestionDeck(list, hotSunny, TODAY);

    // Worn excluded, outerwear excluded on hot day
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain("worn");
    expect(ids).not.toContain("coat");

    // Adjacent items interleaved (tops and bottoms alternate)
    expect(result[0]!.category).not.toBe(result[1]!.category);
  });
});
