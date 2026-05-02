/**
 * Calendar Export + Share Card — Issue 7
 *
 * generateICS   — produces a valid RFC 5545 iCal string from outfit slots.
 * generateShareCard — returns a descriptor for the native share card UI.
 * ICS_MIME_TYPE — exported constant for the .ics MIME type.
 *
 * Issue 7 TDD — Tests 1–8:
 *  Test 1: output contains BEGIN:VCALENDAR … END:VCALENDAR
 *  Test 2: each VEVENT has SUMMARY = slot name
 *  Test 3: DESCRIPTION includes garment list and weather summary
 *  Test 4: name=null → SUMMARY uses auto-generated category name
 *  Test 5: soft-deleted garment → silently omitted
 *  Test 6: vtoImageUrl set → ShareCardData { type:'vto', primaryImageUri }
 *  Test 7: vtoImageUrl null → ShareCardData { type:'collage', garmentImageUris }
 *  Test 8: ICS_MIME_TYPE === 'text/calendar'
 */

import { Garment, GarmentCategory, OutfitSlot } from "./types";
import { DailyForecast } from "./weather";
import { autoName } from "./outfitSlots";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Test 8 */
export const ICS_MIME_TYPE = "text/calendar";

// ── ICS helpers ───────────────────────────────────────────────────────────────

/** "2025-05-05" → "20250505" */
function toIcalDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

/** "2025-05-05" → "2025-05-06" (next calendar day for DTEND all-day events) */
function nextDay(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Escape characters that must be escaped inside iCal text values:
 *   backslash, semicolon, comma, newline.
 */
function escapeIcal(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// ── Category label map (matches outfitSlots.ts autoName) ─────────────────────

const CATEGORY_LABELS: Record<GarmentCategory, string> = {
  tops: "Top",
  bottoms: "Trousers",
  dresses: "Dress",
  outerwear: "Jacket",
  shoes: "Shoes",
  accessories: "Accessories",
  other: "Piece",
};

// ── generateICS ───────────────────────────────────────────────────────────────

/**
 * Tests 1–5
 * Converts an array of confirmed outfit slots into a valid RFC 5545 iCal string.
 *
 * @param slots    Outfit slots to export (any status; callers usually filter to 'confirmed').
 * @param garments Full garment list used to resolve names and categories.
 * @param forecast Optional weather forecast; matched by date for DESCRIPTION.
 */
export function generateICS(
  slots: OutfitSlot[],
  garments: Garment[],
  forecast: DailyForecast[] = [],
): string {
  const forecastByDate = new Map(forecast.map((f) => [f.date, f]));

  const events = slots.map((slot) => {
    const name = slot.name ?? autoName(slot.garmentIds, garments);

    // Resolve live garments for this slot (soft-deleted are excluded — Test 5)
    const liveGarments = slot.garmentIds
      .map((id) => garments.find((g) => g.id === id))
      .filter((g): g is Garment => !!g && g.deletedAt === null);

    const garmentList =
      liveGarments.length > 0
        ? liveGarments.map((g) => g.name).join(", ")
        : "No garments";

    const day = forecastByDate.get(slot.date);
    const weatherSummary = day
      ? `${day.tempMax}°C, ${day.conditionLabel}`
      : null;

    const descParts = [`Garments: ${garmentList}`];
    if (weatherSummary) descParts.push(`Weather: ${weatherSummary}`);
    const description = escapeIcal(descParts.join("\n"));

    const dtStart = toIcalDate(slot.date);
    const dtEnd = toIcalDate(nextDay(slot.date));
    const uid = `fitweek-${slot.id}@fitweek`;

    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${escapeIcal(name)}`,
      `DESCRIPTION:${description}`,
      "END:VEVENT",
    ].join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FitWeek//FitWeek//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

// ── Share card ────────────────────────────────────────────────────────────────

/** Data descriptor returned by generateShareCard (UI renders from this). */
export interface ShareCardData {
  /** 'vto' when a VTO image is available; 'collage' otherwise. */
  type: "vto" | "collage";
  /**
   * VTO image URI (when type='vto').
   * Null when type='collage' — the UI composes the flat-lay from garmentImageUris.
   */
  primaryImageUri: string | null;
  /** Garment image URIs for the 2×2 flat-lay collage (populated when type='collage'). */
  garmentImageUris: string[];
  /** Short day label e.g. "Mon 5 May". */
  dayLabel: string;
  /** Human-readable weather e.g. "22°C, clear sky" or null when unavailable. */
  weatherSummary: string | null;
}

/**
 * Tests 6–7
 * Returns a ShareCardData descriptor.  Does not perform any I/O.
 */
export function generateShareCard(
  slot: OutfitSlot,
  garments: Garment[],
  forecast?: DailyForecast,
): ShareCardData {
  const liveGarments = slot.garmentIds
    .map((id) => garments.find((g) => g.id === id))
    .filter((g): g is Garment => !!g && g.deletedAt === null);

  const weatherSummary = forecast
    ? `${forecast.tempMax}°C, ${forecast.conditionLabel}`
    : null;

  const date = new Date(slot.date + "T12:00:00Z");
  const dayLabel = date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  if (slot.vtoImageUrl) {
    return {
      type: "vto",
      primaryImageUri: slot.vtoImageUrl,
      garmentImageUris: [],
      dayLabel,
      weatherSummary,
    };
  }

  return {
    type: "collage",
    primaryImageUri: null,
    garmentImageUris: liveGarments.map((g) => g.imageUri),
    dayLabel,
    weatherSummary,
  };
}
