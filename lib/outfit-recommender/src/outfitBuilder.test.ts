import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickBestOutfit } from "./outfitBuilder.js";
import { scoreOutfitCohesion } from "./outfitScorer.js";
import { makeGarment, makeForecast, TODAY } from "./test-helpers.js";

describe("outfitBuilder", () => {
  it("builds dress outfit with shoes", () => {
    const garments = [
      makeGarment({ id: "d1", category: "dresses", color: "black" }),
      makeGarment({ id: "s1", category: "shoes", color: "brown" }),
    ];
    const best = pickBestOutfit(garments, makeForecast(), new Set(), TODAY);
    assert.ok(best);
    assert.ok(best.garments.some((g) => g.category === "dresses"));
  });

  it("builds top + bottom outfit", () => {
    const garments = [
      makeGarment({ id: "t1", category: "tops", color: "white" }),
      makeGarment({ id: "b1", category: "bottoms", color: "navy" }),
    ];
    const best = pickBestOutfit(garments, makeForecast(), new Set(), TODAY);
    assert.ok(best);
    const cats = new Set(best.garments.map((g) => g.category));
    assert.ok(cats.has("tops") && cats.has("bottoms"));
  });

  it("returns null for empty wardrobe", () => {
    assert.equal(pickBestOutfit([], null, new Set(), TODAY), null);
  });
});

describe("outfitScorer cohesion", () => {
  it("penalises clashing bright colors", () => {
    const clash = scoreOutfitCohesion(
      [
        makeGarment({ id: "1", category: "tops", color: "red" }),
        makeGarment({ id: "2", category: "bottoms", color: "orange" }),
      ],
      makeForecast(),
    );
    const neutral = scoreOutfitCohesion(
      [
        makeGarment({ id: "3", category: "tops", color: "navy" }),
        makeGarment({ id: "4", category: "bottoms", color: "grey" }),
      ],
      makeForecast(),
    );
    assert.ok(neutral.colorHarmony > clash.colorHarmony);
  });
});
