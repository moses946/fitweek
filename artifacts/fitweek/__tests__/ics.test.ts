/**
 * Issue 7 TDD — Calendar Export + Share Card
 *
 * Test 1: generateICS([slot1, slot2], garments, forecast)
 *         → valid iCal string (BEGIN:VCALENDAR … END:VCALENDAR)
 * Test 2: each VEVENT contains SUMMARY = slot name
 * Test 3: each VEVENT DESCRIPTION includes garment list and weather summary
 * Test 4: slot with name=null → SUMMARY uses auto-generated category-based name
 * Test 5: soft-deleted garment in slot → silently omitted from DESCRIPTION
 * Test 6: generateShareCard where vtoImageUrl is set → type='vto', uses VTO image
 * Test 7: generateShareCard where vtoImageUrl is null → type='collage', garmentImageUris populated
 * Test 8: ICS_MIME_TYPE === 'text/calendar'
 */

import { Garment, OutfitSlot } from "../lib/types";
import { DailyForecast } from "../lib/weather";
import { generateICS, generateShareCard, ICS_MIME_TYPE } from "../lib/ics";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeGarment(overrides: Partial<Garment> = {}): Garment {
  return {
    id: "g1",
    imageUri: "file:///g1.jpg",
    category: "tops",
    color: "white",
    tags: [],
    name: "White Shirt",
    status: "clean",
    wearCount: 0,
    lastWornAt: null,
    lastSkippedAt: null,
    skipUntil: null,
    deletedAt: null,
    createdAt: "2025-05-01T08:00:00.000Z",
    aiDescription: null,
    ...overrides,
  };
}

function makeSlot(overrides: Partial<OutfitSlot> = {}): OutfitSlot {
  return {
    id: "slot-001",
    date: "2025-05-05",
    garmentIds: ["g1"],
    status: "confirmed",
    name: "Monday Outfit",
    createdAt: "2025-05-04T10:00:00.000Z",
    vtoImageUrl: null,
    ...overrides,
  };
}

function makeForecast(overrides: Partial<DailyForecast> = {}): DailyForecast {
  return {
    date: "2025-05-05",
    tempMin: 15,
    tempMax: 22,
    condition: "clear",
    conditionLabel: "clear sky",
    icon: "01d",
    pop: 0.05,
    ...overrides,
  };
}

// ── generateICS ───────────────────────────────────────────────────────────────

describe("generateICS", () => {
  const garments = [
    makeGarment({ id: "g1", name: "White Shirt", category: "tops" }),
    makeGarment({ id: "g2", name: "Blue Jeans", category: "bottoms" }),
  ];
  const forecast = [makeForecast({ date: "2025-05-05" })];

  test("Test 1: output is a valid iCal string with wrapper markers", () => {
    const slot = makeSlot({ garmentIds: ["g1", "g2"] });
    const ics = generateICS([slot], garments, forecast);

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//FitWeek//FitWeek//EN");
  });

  test("Test 2: each VEVENT has SUMMARY equal to slot name", () => {
    const slot1 = makeSlot({ id: "s1", name: "Monday Outfit", date: "2025-05-05" });
    const slot2 = makeSlot({ id: "s2", name: "Friday Look", date: "2025-05-09" });
    const ics = generateICS([slot1, slot2], garments, forecast);

    expect(ics).toContain("SUMMARY:Monday Outfit");
    expect(ics).toContain("SUMMARY:Friday Look");
  });

  test("Test 3: DESCRIPTION includes garment names and weather summary", () => {
    const slot = makeSlot({ garmentIds: ["g1", "g2"] });
    const ics = generateICS([slot], garments, forecast);

    expect(ics).toMatch(/DESCRIPTION:.*White Shirt/s);
    expect(ics).toMatch(/DESCRIPTION:.*Blue Jeans/s);
    expect(ics).toMatch(/DESCRIPTION:.*22°C/s);
    expect(ics).toMatch(/DESCRIPTION:.*clear sky/si);
  });

  test("Test 4: slot.name=null → SUMMARY uses auto-generated category name", () => {
    const slot = makeSlot({ name: null, garmentIds: ["g1", "g2"] });
    const ics = generateICS([slot], garments, []);

    // autoName for tops + bottoms = "Top + Trousers"
    expect(ics).toContain("SUMMARY:Top + Trousers");
  });

  test("Test 5: soft-deleted garment is silently omitted from DESCRIPTION", () => {
    const garmentWithDeletion = makeGarment({
      id: "g2",
      name: "Deleted Jeans",
      deletedAt: "2025-05-03T00:00:00.000Z",
    });
    const allGarments = [
      makeGarment({ id: "g1", name: "White Shirt" }),
      garmentWithDeletion,
    ];
    const slot = makeSlot({ garmentIds: ["g1", "g2"] });
    const ics = generateICS([slot], allGarments, []);

    expect(ics).toContain("White Shirt");
    expect(ics).not.toContain("Deleted Jeans");
  });
});

// ── generateShareCard ─────────────────────────────────────────────────────────

describe("generateShareCard", () => {
  const garments = [
    makeGarment({ id: "g1", imageUri: "file:///g1.jpg" }),
    makeGarment({ id: "g2", imageUri: "file:///g2.jpg", category: "bottoms" }),
  ];
  const forecast = makeForecast();

  test("Test 6: vtoImageUrl set → type='vto' and primaryImageUri equals vtoImageUrl", () => {
    const slot = makeSlot({
      garmentIds: ["g1", "g2"],
      vtoImageUrl: "https://example.com/vto.jpg",
    });
    const card = generateShareCard(slot, garments, forecast);

    expect(card.type).toBe("vto");
    expect(card.primaryImageUri).toBe("https://example.com/vto.jpg");
  });

  test("Test 7: vtoImageUrl null → type='collage' with garment image URIs", () => {
    const slot = makeSlot({ garmentIds: ["g1", "g2"], vtoImageUrl: null });
    const card = generateShareCard(slot, garments, forecast);

    expect(card.type).toBe("collage");
    expect(card.primaryImageUri).toBeNull();
    expect(card.garmentImageUris).toContain("file:///g1.jpg");
    expect(card.garmentImageUris).toContain("file:///g2.jpg");
  });
});

// ── ICS_MIME_TYPE ─────────────────────────────────────────────────────────────

test("Test 8: ICS_MIME_TYPE is 'text/calendar'", () => {
  expect(ICS_MIME_TYPE).toBe("text/calendar");
});
