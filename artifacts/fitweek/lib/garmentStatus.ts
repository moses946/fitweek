/**
 * Pure garment-status transition functions.
 *
 * Each function takes the current garments array + an id and returns a new array.
 * No side effects, no I/O — fully unit-testable without mocking.
 *
 * Issue 3 TDD — Tests 1-5:
 *   Test 1: markWorn(id)     → status = 'worn', wearCount++, lastWornAt set
 *   Test 2: sendToLaundry(id) → status = 'laundry'
 *   Test 3: markWashed(id)   → status = 'clean', skipUntil = null
 *   Test 4: skipForSession(id) → lastSkippedAt = today's date
 *   Test 5: skipForWeek(id) on Wednesday → skipUntil = following Monday
 */

import { Garment } from "./types";

function patch(garments: Garment[], id: string, delta: Partial<Garment>): Garment[] {
  return garments.map((g) => (g.id === id ? { ...g, ...delta } : g));
}

export function toISODate(date: Date = new Date()): string {
  return date.toISOString().split("T")[0]!;
}

/** Returns the ISO date string of the next Monday on or after `from`. */
export function nextMonday(from: Date = new Date()): string {
  const d = new Date(from);
  const day = d.getDay(); // 0 = Sun … 6 = Sat
  // If today is Monday (1), skip a full week. Otherwise advance to next Monday.
  const daysToAdd = day === 1 ? 7 : (8 - day) % 7;
  d.setDate(d.getDate() + daysToAdd);
  return toISODate(d);
}

export function markWorn(garments: Garment[], id: string): Garment[] {
  const g = garments.find((g) => g.id === id);
  if (!g) return garments;
  return patch(garments, id, {
    // status stays 'active' — wear state is tracked via wearCount + lastWornAt
    wearCount: g.wearCount + 1,
    lastWornAt: new Date().toISOString(),
  });
}

export function sendToLaundry(garments: Garment[], id: string): Garment[] {
  return patch(garments, id, { status: "laundry" });
}

export function markWashed(garments: Garment[], id: string): Garment[] {
  return patch(garments, id, { status: "active", skipUntil: null });
}

export function skipForSession(
  garments: Garment[],
  id: string,
  today?: string,
): Garment[] {
  const date = today ?? toISODate();
  return patch(garments, id, { lastSkippedAt: date });
}

export function skipForWeek(
  garments: Garment[],
  id: string,
  now?: Date,
): Garment[] {
  return patch(garments, id, { skipUntil: nextMonday(now) });
}

export function softDelete(garments: Garment[], id: string): Garment[] {
  return patch(garments, id, { deletedAt: new Date().toISOString() });
}

export function restore(garments: Garment[], id: string): Garment[] {
  return patch(garments, id, { deletedAt: null });
}

export function purge(garments: Garment[], id: string): Garment[] {
  return garments.filter((g) => g.id !== id);
}
