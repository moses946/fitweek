/**
 * Pure outfit-slot mutation functions.
 * No side effects — all functions take current state and return new state.
 *
 * Issue 5 TDD — Tests 1-9:
 *  Test 1: addGarmentToSlot → garmentIds contains new ID
 *  Test 2: removeGarmentFromSlot → garmentIds no longer contains ID
 *  Test 3: confirmSlot, name=null → status='confirmed'; auto-name generated
 *  Test 4: confirmSlot, name set → name unchanged
 *  Test 5: clearSlot → slot removed
 *  Test 6: renameSlot → name changed
 *  Test 7: cleanupExpiredDrafts > 24h → removed
 *  Test 8: cleanupExpiredDrafts < 24h → preserved
 *  Test 9: markAllWorn → all garments in slot returned with status='worn'
 */

import { Garment, GarmentCategory, OutfitSlot, GarmentStatus } from "./types";

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

const CATEGORY_LABELS: Record<GarmentCategory, string> = {
  tops: "Top",
  bottoms: "Trousers",
  dresses: "Dress",
  outerwear: "Jacket",
  shoes: "Shoes",
  accessories: "Accessories",
  other: "Piece",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function autoName(garmentIds: string[], garments: Garment[]): string {
  const seen = new Set<GarmentCategory>();
  const labels: string[] = [];
  for (const id of garmentIds) {
    const g = garments.find((x) => x.id === id);
    if (g && !seen.has(g.category)) {
      seen.add(g.category);
      labels.push(CATEGORY_LABELS[g.category]);
    }
  }
  return labels.length > 0 ? labels.join(" + ") : "Outfit";
}

function makeDefaultId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Slot mutations ────────────────────────────────────────────────────────────

/** Test 1 */
export function addGarmentToSlot(
  slots: OutfitSlot[],
  slotId: string,
  garmentId: string,
): OutfitSlot[] {
  return slots.map((s) =>
    s.id === slotId && !s.garmentIds.includes(garmentId)
      ? { ...s, garmentIds: [...s.garmentIds, garmentId] }
      : s,
  );
}

/** Test 2 */
export function removeGarmentFromSlot(
  slots: OutfitSlot[],
  slotId: string,
  garmentId: string,
): OutfitSlot[] {
  return slots.map((s) =>
    s.id === slotId
      ? { ...s, garmentIds: s.garmentIds.filter((id) => id !== garmentId) }
      : s,
  );
}

/** Tests 3-4 */
export function confirmSlot(
  slots: OutfitSlot[],
  slotId: string,
  garments: Garment[],
): OutfitSlot[] {
  return slots.map((s) => {
    if (s.id !== slotId) return s;
    const name = s.name ?? autoName(s.garmentIds, garments);
    return { ...s, status: "confirmed" as const, name };
  });
}

/** Test 5 */
export function clearSlot(slots: OutfitSlot[], slotId: string): OutfitSlot[] {
  return slots.filter((s) => s.id !== slotId);
}

/** Test 6 */
export function renameSlot(
  slots: OutfitSlot[],
  slotId: string,
  name: string,
): OutfitSlot[] {
  return slots.map((s) => (s.id === slotId ? { ...s, name } : s));
}

/** Tests 7-8 — deletes draft slots older than 24 hours */
export function cleanupExpiredDrafts(
  slots: OutfitSlot[],
  now: Date,
): OutfitSlot[] {
  return slots.filter((s) => {
    if (s.status !== "draft") return true;
    return now.getTime() - new Date(s.createdAt).getTime() < DRAFT_TTL_MS;
  });
}

/** Test 9 — returns garments with all slot members set to 'worn' */
export function markAllWorn(
  slots: OutfitSlot[],
  slotId: string,
  garments: Garment[],
): Garment[] {
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) return garments;
  const wornSet = new Set(slot.garmentIds);
  return garments.map((g) =>
    wornSet.has(g.id) ? { ...g, status: "worn" as GarmentStatus } : g,
  );
}

// ── Draft slot management ─────────────────────────────────────────────────────

/** Returns the existing draft for a date, or creates a new one. */
export function getOrCreateDraftSlot(
  slots: OutfitSlot[],
  date: string,
  makeId: () => string = makeDefaultId,
): { slot: OutfitSlot; slots: OutfitSlot[] } {
  const existing = slots.find((s) => s.date === date && s.status === "draft");
  if (existing) return { slot: existing, slots };
  const slot: OutfitSlot = {
    id: makeId(),
    date,
    garmentIds: [],
    status: "draft",
    name: null,
    createdAt: new Date().toISOString(),
  };
  return { slot, slots: [...slots, slot] };
}

/** Returns all garmentIds used in confirmed slots for a given week range. */
export function getConfirmedGarmentIds(
  slots: OutfitSlot[],
  excludeDate?: string,
): Set<string> {
  const ids = new Set<string>();
  for (const s of slots) {
    if (s.status === "confirmed" && s.date !== excludeDate) {
      for (const id of s.garmentIds) ids.add(id);
    }
  }
  return ids;
}
