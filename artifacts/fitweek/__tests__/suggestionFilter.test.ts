/**
 * Issue 3 — TDD: suggestionFilter unit tests (Tests 6–11 from plan)
 *
 * Pure functions — no mocking needed.
 * Run: pnpm --filter @workspace/fitweek test
 */

import {
  isSkippedToday,
  isSkippedUntil,
  isSuggestable,
  filterSuggestable,
} from "../lib/suggestionFilter";
import { Garment } from "../lib/types";

const TODAY = new Date("2026-05-02T12:00:00Z"); // Saturday
const TODAY_STR = "2026-05-02";
const YESTERDAY_STR = "2026-05-01";
const TOMORROW_STR = "2026-05-03";
const LAST_MONDAY_STR = "2026-04-27";
const NEXT_MONDAY_STR = "2026-05-04";

const base: Garment = {
  id: "g1",
  imageUri: "test://img",
  category: "tops",
  color: "Blue",
  tags: [],
  name: "Blue Shirt",
  status: "clean",
  wearCount: 0,
  lastWornAt: null,
  lastSkippedAt: null,
  skipUntil: null,
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function g(overrides: Partial<Garment> = {}): Garment {
  return { ...base, ...overrides };
}

// ─── Test 6: lastSkippedAt = today → excluded ─────────────────────────────────
describe("isSkippedToday", () => {
  it("returns true when lastSkippedAt equals today", () => {
    expect(isSkippedToday(g({ lastSkippedAt: TODAY_STR }), TODAY)).toBe(true);
  });

  // Test 7: lastSkippedAt = yesterday → included
  it("returns false when lastSkippedAt is yesterday", () => {
    expect(isSkippedToday(g({ lastSkippedAt: YESTERDAY_STR }), TODAY)).toBe(false);
  });

  it("returns false when lastSkippedAt is null", () => {
    expect(isSkippedToday(g(), TODAY)).toBe(false);
  });
});

// ─── Test 8: skipUntil = next Monday → excluded ──────────────────────────────
describe("isSkippedUntil", () => {
  it("returns true when skipUntil is in the future (next Monday)", () => {
    expect(isSkippedUntil(g({ skipUntil: NEXT_MONDAY_STR }), TODAY)).toBe(true);
  });

  it("returns true when skipUntil equals today", () => {
    expect(isSkippedUntil(g({ skipUntil: TODAY_STR }), TODAY)).toBe(true);
  });

  // Test 9: skipUntil = last Monday → included
  it("returns false when skipUntil is in the past (last Monday)", () => {
    expect(isSkippedUntil(g({ skipUntil: LAST_MONDAY_STR }), TODAY)).toBe(false);
  });

  it("returns false when skipUntil is null", () => {
    expect(isSkippedUntil(g(), TODAY)).toBe(false);
  });
});

// ─── isSuggestable ────────────────────────────────────────────────────────────
describe("isSuggestable", () => {
  it("returns true for a clean, non-deleted, non-skipped garment", () => {
    expect(isSuggestable(g(), TODAY)).toBe(true);
  });

  // Test 10: status != 'clean' → excluded
  it("returns false when status is 'laundry'", () => {
    expect(isSuggestable(g({ status: "laundry" }), TODAY)).toBe(false);
  });

  it("returns false when status is 'worn'", () => {
    expect(isSuggestable(g({ status: "worn" }), TODAY)).toBe(false);
  });

  // Test 11: deletedAt set → excluded
  it("returns false when deletedAt is set", () => {
    expect(
      isSuggestable(g({ deletedAt: "2026-05-02T09:00:00.000Z" }), TODAY),
    ).toBe(false);
  });

  it("returns false when skipped today", () => {
    expect(isSuggestable(g({ lastSkippedAt: TODAY_STR }), TODAY)).toBe(false);
  });

  it("returns false when in a skip window (skipUntil in the future)", () => {
    expect(isSuggestable(g({ skipUntil: NEXT_MONDAY_STR }), TODAY)).toBe(false);
  });

  it("returns true when skip window has passed", () => {
    expect(isSuggestable(g({ skipUntil: LAST_MONDAY_STR }), TODAY)).toBe(true);
  });

  it("returns true when skipped yesterday (not today)", () => {
    expect(isSuggestable(g({ lastSkippedAt: YESTERDAY_STR }), TODAY)).toBe(true);
  });
});

// ─── filterSuggestable ────────────────────────────────────────────────────────
describe("filterSuggestable", () => {
  it("returns only clean, live, non-skipped garments", () => {
    const list: Garment[] = [
      g({ id: "a" }),                                           // ✓ included
      g({ id: "b", status: "worn" }),                           // ✗ worn
      g({ id: "c", status: "laundry" }),                        // ✗ laundry
      g({ id: "d", deletedAt: "2026-05-01T00:00:00.000Z" }),   // ✗ deleted
      g({ id: "e", lastSkippedAt: TODAY_STR }),                 // ✗ skipped today
      g({ id: "f", skipUntil: NEXT_MONDAY_STR }),              // ✗ skip window
      g({ id: "g_ok", skipUntil: LAST_MONDAY_STR }),           // ✓ skip window expired
      g({ id: "h_ok", lastSkippedAt: YESTERDAY_STR }),         // ✓ skipped yesterday
    ];

    const result = filterSuggestable(list, TODAY);
    const ids = result.map((r) => r.id);
    expect(ids).toContain("a");
    expect(ids).toContain("g_ok");
    expect(ids).toContain("h_ok");
    expect(ids).not.toContain("b");
    expect(ids).not.toContain("c");
    expect(ids).not.toContain("d");
    expect(ids).not.toContain("e");
    expect(ids).not.toContain("f");
    expect(result).toHaveLength(3);
  });
});
