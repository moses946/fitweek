import type { Garment, DailyForecast } from "../types.js";

export const TODAY = new Date("2026-05-07T00:00:00Z");

export function daysAgo(days: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function makeGarment(
  overrides: Partial<Garment> & { id: string },
): Garment {
  return {
    imageUrl: "",
    category: "tops",
    color: "navy",
    tags: [],
    name: "Test Garment",
    status: "active",
    wearCount: 0,
    lastWornAt: null,
    lastSkippedAt: null,
    skipUntil: null,
    deletedAt: null,
    createdAt: "2026-05-01T00:00:00Z",
    aiDescription: null,
    ...overrides,
  };
}

export function makeForecast(
  overrides: Partial<DailyForecast> = {},
): DailyForecast {
  return {
    date: "2026-05-07",
    tempMin: 15,
    tempMax: 22,
    condition: "clear",
    conditionLabel: "Clear sky",
    icon: "01d",
    pop: 0,
    ...overrides,
  };
}
