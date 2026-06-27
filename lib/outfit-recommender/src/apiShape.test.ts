import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recommendForWeekAsRecord } from "./index.js";
import { makeGarment, makeForecast, TODAY } from "./test-helpers.js";

describe("recommendForWeekAsRecord (API shape)", () => {
  it("returns suggestions and meta maps", () => {
    const garments = [
      makeGarment({ id: "t1", category: "tops" }),
      makeGarment({ id: "b1", category: "bottoms" }),
    ];
    const forecasts = new Map([["2026-05-07", makeForecast()]]);
    const { suggestions, meta } = recommendForWeekAsRecord({
      dates: ["2026-05-07"],
      garments,
      forecasts,
      today: TODAY,
    });
    assert.ok(Array.isArray(suggestions["2026-05-07"]));
    assert.ok(suggestions["2026-05-07"]!.length >= 2);
    assert.ok(meta["2026-05-07"]?.deck);
    assert.ok(typeof meta["2026-05-07"]?.score === "number");
  });
});
