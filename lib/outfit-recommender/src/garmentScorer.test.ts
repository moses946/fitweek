import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  recencyScore,
  weatherFitScore,
  tagFitScore,
  colorNeutralScore,
  scoreAndRank,
} from "./garmentScorer.js";
import { makeGarment, makeForecast, TODAY, daysAgo } from "./test-helpers.js";

describe("garmentScorer", () => {
  it("recency returns 1.0 for never worn", () => {
    assert.equal(recencyScore(null, TODAY), 1.0);
  });

  it("recency decays for recently worn", () => {
    assert.ok(recencyScore(daysAgo(3), TODAY) < 1.0);
  });

  it("penalises outerwear in hot weather", () => {
    const hot = makeForecast({ tempMax: 30 });
    assert.equal(weatherFitScore("outerwear", hot), 0);
    assert.equal(weatherFitScore("tops", hot), 1);
  });

  it("boosts wool tags in cold weather", () => {
    const cold = makeForecast({ tempMax: 5 });
    const wool = tagFitScore(["wool sweater"], cold);
    const plain = tagFitScore([], cold);
    assert.ok(wool > plain);
  });

  it("rewards neutral colors", () => {
    assert.ok(colorNeutralScore("navy") > colorNeutralScore("red"));
  });

  it("ranks fresher garments higher", () => {
    const worn = makeGarment({ id: "w", lastWornAt: daysAgo(1), wearCount: 3 });
    const fresh = makeGarment({ id: "f", createdAt: "2026-05-06T00:00:00Z" });
    const ranked = scoreAndRank([worn, fresh], null, new Set(), TODAY);
    assert.equal(ranked[0]!.garment.id, "f");
  });
});
