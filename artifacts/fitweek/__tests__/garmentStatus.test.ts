/**
 * Issue 3 — TDD: garmentStatus unit tests (Tests 1–5 from plan + extras)
 *
 * Pure functions only — no mocking needed.
 * Run: pnpm --filter @workspace/fitweek test
 */

import {
  markWorn,
  sendToLaundry,
  markWashed,
  skipForSession,
  skipForWeek,
  softDelete,
  restore,
  purge,
  nextMonday,
  toISODate,
} from "../lib/garmentStatus";
import { Garment } from "../lib/types";

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

function garments(...overrides: Partial<Garment>[]): Garment[] {
  if (overrides.length === 0) return [{ ...base }];
  return overrides.map((o, i) => ({ ...base, id: `g${i + 1}`, ...o }));
}

// ─── Test 1 ───────────────────────────────────────────────────────────────────
describe("markWorn", () => {
  it("sets status to 'worn', increments wearCount, and sets lastWornAt", () => {
    const result = markWorn(garments(), "g1");
    expect(result[0]!.status).toBe("worn");
    expect(result[0]!.wearCount).toBe(1);
    expect(result[0]!.lastWornAt).not.toBeNull();
  });

  it("does not affect other garments", () => {
    const list = garments({}, { id: "g2" });
    const result = markWorn(list, "g1");
    expect(result[1]!.status).toBe("clean");
  });

  it("ignores unknown id", () => {
    const list = garments();
    const result = markWorn(list, "unknown");
    expect(result).toEqual(list);
  });
});

// ─── Test 2 ───────────────────────────────────────────────────────────────────
describe("sendToLaundry", () => {
  it("sets status to 'laundry'", () => {
    const result = sendToLaundry(garments(), "g1");
    expect(result[0]!.status).toBe("laundry");
  });
});

// ─── Test 3 ───────────────────────────────────────────────────────────────────
describe("markWashed", () => {
  it("sets status to 'clean' and clears skipUntil", () => {
    const list = garments({ status: "laundry", skipUntil: "2026-06-02" });
    const result = markWashed(list, "g1");
    expect(result[0]!.status).toBe("clean");
    expect(result[0]!.skipUntil).toBeNull();
  });
});

// ─── Test 4 ───────────────────────────────────────────────────────────────────
describe("skipForSession", () => {
  it("sets lastSkippedAt to today's ISO date", () => {
    const today = "2026-05-02";
    const result = skipForSession(garments(), "g1", today);
    expect(result[0]!.lastSkippedAt).toBe(today);
  });

  it("uses today's date when no explicit date is passed", () => {
    const result = skipForSession(garments(), "g1");
    expect(result[0]!.lastSkippedAt).toBe(toISODate());
  });
});

// ─── Test 5 ───────────────────────────────────────────────────────────────────
describe("skipForWeek", () => {
  it("sets skipUntil to the following Monday when called on Thursday 1 May 2025", () => {
    const thursday = new Date("2025-05-01T12:00:00Z"); // Thu
    const result = skipForWeek(garments(), "g1", thursday);
    expect(result[0]!.skipUntil).toBe("2025-05-05"); // following Monday
  });

  it("sets skipUntil to the following Monday when called on Wednesday", () => {
    const wednesday = new Date("2026-04-29T12:00:00Z"); // Wed
    const result = skipForWeek(garments(), "g1", wednesday);
    expect(result[0]!.skipUntil).toBe("2026-05-04"); // following Monday
  });

  it("skips a full week when called on Monday", () => {
    const monday = new Date("2026-05-04T12:00:00Z"); // Mon
    const result = skipForWeek(garments(), "g1", monday);
    expect(result[0]!.skipUntil).toBe("2026-05-11"); // next Monday
  });

  it("sets skipUntil to Monday when called on Sunday", () => {
    const sunday = new Date("2026-05-03T12:00:00Z"); // Sun
    const result = skipForWeek(garments(), "g1", sunday);
    expect(result[0]!.skipUntil).toBe("2026-05-04"); // next day is Monday
  });
});

// ─── nextMonday helper ────────────────────────────────────────────────────────
describe("nextMonday", () => {
  const cases: [string, string, string][] = [
    ["Sunday 2026-05-03", "2026-05-03", "2026-05-04"],
    ["Monday 2026-05-04", "2026-05-04", "2026-05-11"],
    ["Tuesday 2026-05-05", "2026-05-05", "2026-05-11"],
    ["Wednesday 2026-04-29", "2026-04-29", "2026-05-04"],
    ["Thursday 2025-05-01", "2025-05-01", "2025-05-05"],
    ["Friday 2026-05-01", "2026-05-01", "2026-05-04"],
    ["Saturday 2026-05-02", "2026-05-02", "2026-05-04"],
  ];

  test.each(cases)("%s → %s", (_label, input, expected) => {
    expect(nextMonday(new Date(`${input}T12:00:00Z`))).toBe(expected);
  });
});

// ─── softDelete / restore / purge ────────────────────────────────────────────
describe("softDelete", () => {
  it("sets deletedAt to a non-null ISO string", () => {
    const result = softDelete(garments(), "g1");
    expect(result[0]!.deletedAt).not.toBeNull();
  });
});

describe("restore", () => {
  it("clears deletedAt", () => {
    const list = garments({ deletedAt: "2026-05-02T10:00:00.000Z" });
    const result = restore(list, "g1");
    expect(result[0]!.deletedAt).toBeNull();
  });
});

describe("purge", () => {
  it("removes the garment from the array entirely", () => {
    const list = garments({}, { id: "g2" });
    const result = purge(list, "g1");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("g2");
  });
});
