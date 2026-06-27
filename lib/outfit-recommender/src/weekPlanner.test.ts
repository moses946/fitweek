import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recommendForWeek, recommendForDay } from "./index.js";
import { buildSwipeDeckIds } from "./deckBuilder.js";
import { makeGarment, makeForecast, TODAY } from "./test-helpers.js";

describe("weekPlanner", () => {
  it("assigns different tops across two days when alternatives exist", () => {
    const garments = [
      makeGarment({ id: "t1", category: "tops", createdAt: "2026-05-03T00:00:00Z" }),
      makeGarment({ id: "t2", category: "tops", createdAt: "2026-05-02T00:00:00Z" }),
      makeGarment({ id: "b1", category: "bottoms" }),
      makeGarment({ id: "b2", category: "bottoms" }),
    ];
    const forecasts = new Map([
      ["2026-05-07", makeForecast({ date: "2026-05-07" })],
      ["2026-05-08", makeForecast({ date: "2026-05-08" })],
    ]);
    const result = recommendForWeek({
      dates: ["2026-05-07", "2026-05-08"],
      garments,
      forecasts,
      today: TODAY,
    });
    const d1 = result.get("2026-05-07");
    const d2 = result.get("2026-05-08");
    assert.ok(d1 && d2);
    const tops = [
      ...d1.outfitIds.filter((id) => id.startsWith("t")),
      ...d2.outfitIds.filter((id) => id.startsWith("t")),
    ];
    assert.equal(new Set(tops).size, 2);
  });

  it("respects already planned garments", () => {
    const garments = [
      makeGarment({ id: "t1", category: "tops" }),
      makeGarment({ id: "t2", category: "tops" }),
      makeGarment({ id: "b1", category: "bottoms" }),
    ];
    const forecasts = new Map([["2026-05-07", makeForecast()]]);
    const alreadyPlanned = new Map([["2026-05-06", ["t1"]]]);
    const result = recommendForWeek({
      dates: ["2026-05-07"],
      garments,
      forecasts,
      alreadyPlanned,
      today: TODAY,
    });
    const day = result.get("2026-05-07");
    assert.ok(day);
    assert.ok(!day.outfitIds.includes("t1"));
  });
});

describe("deckBuilder", () => {
  it("puts hero first in deck", () => {
    const garments = [
      makeGarment({ id: "t1", category: "tops" }),
      makeGarment({ id: "t2", category: "tops", createdAt: "2026-05-06T00:00:00Z" }),
    ];
    const deck = buildSwipeDeckIds(garments, null, new Set(), TODAY, undefined, "t2");
    assert.equal(deck[0], "t2");
  });
});

describe("recommendForDay", () => {
  it("returns outfit ids and deck", () => {
    const garments = [
      makeGarment({ id: "t1", category: "tops" }),
      makeGarment({ id: "b1", category: "bottoms" }),
    ];
    const rec = recommendForDay({
      date: "2026-05-07",
      garments,
      forecast: makeForecast(),
      today: TODAY,
    });
    assert.ok(rec);
    assert.ok(rec.outfitIds.length >= 2);
    assert.ok(rec.deck.length >= 2);
  });
});
