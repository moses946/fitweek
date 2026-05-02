/**
 * Issue 5 — TDD: outfit slot unit tests (Tests 1–10 from plan)
 *
 * Pure functions — no mocking needed except for time-dependent tests.
 * Run: pnpm --filter @workspace/fitweek test
 */

import {
  addGarmentToSlot,
  removeGarmentFromSlot,
  confirmSlot,
  clearSlot,
  renameSlot,
  cleanupExpiredDrafts,
  markAllWorn,
  getOrCreateDraftSlot,
  autoName,
} from "../lib/outfitSlots";
import { computeNextSundayAt7pm } from "../lib/outfitSlotNotifications";
import type { OutfitSlot } from "../lib/types";
import type { Garment } from "../lib/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function slot(overrides: Partial<OutfitSlot> & { id: string }): OutfitSlot {
  return {
    date: "2026-05-04",
    garmentIds: [],
    status: "draft",
    name: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function garment(id: string, category: Garment["category"] = "tops"): Garment {
  return {
    id,
    imageUri: "test://img",
    category,
    color: "Blue",
    tags: [],
    name: "Test",
    status: "clean",
    wearCount: 0,
    lastWornAt: null,
    lastSkippedAt: null,
    skipUntil: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
  };
}

const BASE_SLOTS: OutfitSlot[] = [slot({ id: "s1", garmentIds: ["g1", "g2"] })];
const BASE_GARMENTS: Garment[] = [
  garment("g1", "tops"),
  garment("g2", "bottoms"),
  garment("g3", "dresses"),
];

// ─── Test 1: addGarmentToSlot ─────────────────────────────────────────────────
describe("addGarmentToSlot — Test 1", () => {
  it("adds garmentId to the slot's garmentIds array", () => {
    const result = addGarmentToSlot([slot({ id: "s1" })], "s1", "g1");
    expect(result[0]!.garmentIds).toContain("g1");
  });

  it("does not add duplicates", () => {
    const result = addGarmentToSlot(
      [slot({ id: "s1", garmentIds: ["g1"] })],
      "s1",
      "g1",
    );
    expect(result[0]!.garmentIds.filter((id) => id === "g1")).toHaveLength(1);
  });

  it("leaves other slots unchanged", () => {
    const slots = [slot({ id: "s1" }), slot({ id: "s2" })];
    const result = addGarmentToSlot(slots, "s1", "g1");
    expect(result[1]!.garmentIds).toHaveLength(0);
  });
});

// ─── Test 2: removeGarmentFromSlot ───────────────────────────────────────────
describe("removeGarmentFromSlot — Test 2", () => {
  it("removes garmentId from garmentIds", () => {
    const result = removeGarmentFromSlot(BASE_SLOTS, "s1", "g1");
    expect(result[0]!.garmentIds).not.toContain("g1");
  });

  it("preserves other garmentIds in the slot", () => {
    const result = removeGarmentFromSlot(BASE_SLOTS, "s1", "g1");
    expect(result[0]!.garmentIds).toContain("g2");
  });

  it("is a no-op when garmentId is not in the slot", () => {
    const result = removeGarmentFromSlot(BASE_SLOTS, "s1", "g99");
    expect(result[0]!.garmentIds).toEqual(["g1", "g2"]);
  });
});

// ─── Test 3: confirmSlot — name is null ──────────────────────────────────────
describe("confirmSlot — Test 3: auto-name generated", () => {
  it("sets status to 'confirmed'", () => {
    const result = confirmSlot(BASE_SLOTS, "s1", BASE_GARMENTS);
    expect(result[0]!.status).toBe("confirmed");
  });

  it("auto-generates name from garment categories when name is null", () => {
    const result = confirmSlot(BASE_SLOTS, "s1", BASE_GARMENTS);
    expect(result[0]!.name).toBe("Top + Trousers");
  });

  it("auto-names a dress slot correctly", () => {
    const dressSlot = [slot({ id: "s1", garmentIds: ["g3"] })];
    const result = confirmSlot(dressSlot, "s1", BASE_GARMENTS);
    expect(result[0]!.name).toBe("Dress");
  });
});

// ─── Test 4: confirmSlot — name already set ──────────────────────────────────
describe("confirmSlot — Test 4: name preserved", () => {
  it("does not overwrite an existing name", () => {
    const namedSlot = [slot({ id: "s1", garmentIds: ["g1"], name: "Date Night" })];
    const result = confirmSlot(namedSlot, "s1", BASE_GARMENTS);
    expect(result[0]!.name).toBe("Date Night");
  });
});

// ─── Test 5: clearSlot ───────────────────────────────────────────────────────
describe("clearSlot — Test 5", () => {
  it("removes the slot from the array", () => {
    const slots = [slot({ id: "s1" }), slot({ id: "s2" })];
    const result = clearSlot(slots, "s1");
    expect(result.find((s) => s.id === "s1")).toBeUndefined();
  });

  it("preserves other slots", () => {
    const slots = [slot({ id: "s1" }), slot({ id: "s2" })];
    const result = clearSlot(slots, "s1");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("s2");
  });
});

// ─── Test 6: renameSlot ──────────────────────────────────────────────────────
describe("renameSlot — Test 6", () => {
  it("updates the slot name", () => {
    const result = renameSlot(BASE_SLOTS, "s1", "Date Night");
    expect(result[0]!.name).toBe("Date Night");
  });

  it("leaves other slots unchanged", () => {
    const slots = [slot({ id: "s1" }), slot({ id: "s2", name: "Original" })];
    const result = renameSlot(slots, "s1", "New Name");
    expect(result[1]!.name).toBe("Original");
  });
});

// ─── Test 7: draft expiry > 24h ──────────────────────────────────────────────
describe("cleanupExpiredDrafts — Test 7", () => {
  it("removes draft slots older than 24 hours", () => {
    const MS_25H = 25 * 60 * 60 * 1000;
    const oldSlot = slot({
      id: "s1",
      status: "draft",
      createdAt: new Date(Date.now() - MS_25H).toISOString(),
    });
    const result = cleanupExpiredDrafts([oldSlot], new Date());
    expect(result).toHaveLength(0);
  });

  it("keeps confirmed slots regardless of age", () => {
    const MS_48H = 48 * 60 * 60 * 1000;
    const oldConfirmed = slot({
      id: "s1",
      status: "confirmed",
      createdAt: new Date(Date.now() - MS_48H).toISOString(),
    });
    const result = cleanupExpiredDrafts([oldConfirmed], new Date());
    expect(result).toHaveLength(1);
  });
});

// ─── Test 8: draft expiry < 24h ──────────────────────────────────────────────
describe("cleanupExpiredDrafts — Test 8", () => {
  it("preserves draft slots younger than 24 hours", () => {
    const MS_1H = 1 * 60 * 60 * 1000;
    const freshSlot = slot({
      id: "s1",
      status: "draft",
      createdAt: new Date(Date.now() - MS_1H).toISOString(),
    });
    const result = cleanupExpiredDrafts([freshSlot], new Date());
    expect(result).toHaveLength(1);
  });
});

// ─── Test 9: markAllWorn ─────────────────────────────────────────────────────
describe("markAllWorn — Test 9", () => {
  it("sets all garments in the slot to 'worn'", () => {
    const result = markAllWorn(BASE_SLOTS, "s1", BASE_GARMENTS);
    const g1 = result.find((g) => g.id === "g1");
    const g2 = result.find((g) => g.id === "g2");
    expect(g1!.status).toBe("worn");
    expect(g2!.status).toBe("worn");
  });

  it("does not change garments not in the slot", () => {
    const result = markAllWorn(BASE_SLOTS, "s1", BASE_GARMENTS);
    const g3 = result.find((g) => g.id === "g3");
    expect(g3!.status).toBe("clean");
  });

  it("returns garments unchanged when slotId does not exist", () => {
    const result = markAllWorn(BASE_SLOTS, "nonexistent", BASE_GARMENTS);
    expect(result).toEqual(BASE_GARMENTS);
  });
});

// ─── Test 10: Sunday notification time ───────────────────────────────────────
describe("computeNextSundayAt7pm — Test 10", () => {
  it("returns the next Sunday at 19:00:00 from a Thursday", () => {
    // Thursday 2026-05-07
    const thursday = new Date("2026-05-07T10:00:00");
    const result = computeNextSundayAt7pm(thursday);
    expect(result.getDay()).toBe(0); // Sunday
    expect(result.getHours()).toBe(19);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    // Should be 2026-05-10 (3 days later)
    expect(result.getDate()).toBe(10);
  });

  it("returns next week's Sunday when today is Sunday", () => {
    // Sunday 2026-05-03
    const sunday = new Date("2026-05-03T08:00:00");
    const result = computeNextSundayAt7pm(sunday);
    expect(result.getDay()).toBe(0);
    // Should be 2026-05-10 (7 days later)
    expect(result.getDate()).toBe(10);
    expect(result.getHours()).toBe(19);
  });

  it("returns next Sunday from a Monday", () => {
    // Monday 2026-05-04
    const monday = new Date("2026-05-04T09:00:00");
    const result = computeNextSundayAt7pm(monday);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(10); // 6 days later
  });
});

// ─── autoName ─────────────────────────────────────────────────────────────────
describe("autoName helper", () => {
  it("concatenates unique category labels with ' + '", () => {
    expect(autoName(["g1", "g2"], BASE_GARMENTS)).toBe("Top + Trousers");
  });

  it("deduplicates categories", () => {
    const twoTops = [garment("t1", "tops"), garment("t2", "tops")];
    expect(autoName(["t1", "t2"], twoTops)).toBe("Top");
  });

  it("returns 'Outfit' for empty garmentIds", () => {
    expect(autoName([], BASE_GARMENTS)).toBe("Outfit");
  });
});

// ─── getOrCreateDraftSlot ────────────────────────────────────────────────────
describe("getOrCreateDraftSlot", () => {
  it("creates a new draft slot when none exists for the date", () => {
    const { slot, slots } = getOrCreateDraftSlot([], "2026-05-04", () => "id1");
    expect(slot.id).toBe("id1");
    expect(slot.date).toBe("2026-05-04");
    expect(slot.status).toBe("draft");
    expect(slots).toHaveLength(1);
  });

  it("returns the existing draft slot when one already exists", () => {
    const existing = slot({ id: "existing", date: "2026-05-04", status: "draft" });
    const { slot: returned, slots } = getOrCreateDraftSlot(
      [existing],
      "2026-05-04",
    );
    expect(returned.id).toBe("existing");
    expect(slots).toHaveLength(1); // no new slot added
  });
});
