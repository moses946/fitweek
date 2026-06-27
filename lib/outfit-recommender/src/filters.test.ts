import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSuggestable, filterSuggestableWithWeather } from "./filters.js";
import { makeGarment, makeForecast } from "./test-helpers.js";

describe("filters", () => {
  it("excludes laundry garments", () => {
    const g = makeGarment({ id: "1", status: "laundry" });
    assert.equal(isSuggestable(g), false);
  });

  it("excludes skipped-today garments", () => {
    const g = makeGarment({ id: "1", lastSkippedAt: "2026-05-07" });
    const d = new Date("2026-05-07T12:00:00Z");
    assert.equal(isSuggestable(g, d), false);
  });

  it("filters outerwear in hot weather", () => {
    const hot = makeForecast({ tempMax: 32 });
    const garments = [
      makeGarment({ id: "t", category: "tops" }),
      makeGarment({ id: "j", category: "outerwear" }),
    ];
    const result = filterSuggestableWithWeather(garments, hot);
    assert.deepEqual(result.map((g) => g.id), ["t"]);
  });
});
