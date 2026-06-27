/**
 * Issue 4 — TDD: weather service unit tests (Tests 1–3 from plan)
 *
 * Mocks: global fetch + storage adapter (in-memory).
 * Run: pnpm --filter @workspace/fitweek test
 */

import { getWeatherForecast } from "../lib/weather";
import type { DailyForecast } from "../lib/weather";
import storage from "../lib/storage";

const BASE = "http://localhost-test";
const LAT = 51.5;
const LON = -0.1;

const mockDays: DailyForecast[] = Array.from({ length: 7 }, (_, i) => ({
  date: `2026-05-0${i + 1}`,
  tempMin: 10 + i,
  tempMax: 18 + i,
  condition: "clear" as const,
  conditionLabel: "clear sky",
  icon: "01d",
  pop: 0,
}));

const CACHE_KEY = `@fitweek/weather_v1_${LAT.toFixed(1)}_${LON.toFixed(1)}`;

beforeEach(async () => {
  storage.resetStorage();
  jest.restoreAllMocks();
});

// ─── Test 1: success response ─────────────────────────────────────────────────
describe("getWeatherForecast — Test 1: success", () => {
  it("returns parsed days, usingCache=false, weatherUnavailable=false", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDays),
    } as unknown as Response);

    const result = await getWeatherForecast(LAT, LON, BASE);

    expect(result.days).toHaveLength(7);
    expect(result.days[0]!.condition).toBe("clear");
    expect(result.usingCache).toBe(false);
    expect(result.weatherUnavailable).toBe(false);
  });

  it("writes the result to AsyncStorage cache", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDays),
    } as unknown as Response);

    await getWeatherForecast(LAT, LON, BASE);

    const raw = await storage.getString(CACHE_KEY);
    expect(raw).not.toBeNull();
    const entry = JSON.parse(raw!);
    expect(entry.days).toHaveLength(7);
    expect(typeof entry.fetchedAt).toBe("number");
  });
});

// ─── Test 2: fetch fails, valid cache exists ──────────────────────────────────
describe("getWeatherForecast — Test 2: cache fallback", () => {
  it("returns cached data with usingCache=true when fetch fails", async () => {
    // Prime a valid cache entry (1 second old — well within 24h TTL)
    await storage.setString(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now() - 1_000, days: mockDays }),
    );

    global.fetch = jest.fn().mockRejectedValueOnce(new Error("Network error"));

    const result = await getWeatherForecast(LAT, LON, BASE);

    expect(result.days).toHaveLength(7);
    expect(result.usingCache).toBe(true);
    expect(result.weatherUnavailable).toBe(false);
  });

  it("ignores an expired cache (> 24h old) and returns unavailable", async () => {
    const MS_25H = 25 * 60 * 60 * 1000;
    await storage.setString(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now() - MS_25H, days: mockDays }),
    );

    global.fetch = jest.fn().mockRejectedValueOnce(new Error("Timeout"));

    const result = await getWeatherForecast(LAT, LON, BASE);

    expect(result.weatherUnavailable).toBe(true);
    expect(result.days).toHaveLength(0);
  });
});

// ─── Test 3: fetch fails, no cache ───────────────────────────────────────────
describe("getWeatherForecast — Test 3: unavailable", () => {
  it("returns empty days + weatherUnavailable=true when fetch fails and cache is empty", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("Network error"));

    const result = await getWeatherForecast(LAT, LON, BASE);

    expect(result.days).toHaveLength(0);
    expect(result.usingCache).toBe(false);
    expect(result.weatherUnavailable).toBe(true);
  });

  it("returns weatherUnavailable=true on non-OK HTTP response with no cache", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as unknown as Response);

    const result = await getWeatherForecast(LAT, LON, BASE);

    expect(result.weatherUnavailable).toBe(true);
    expect(result.usingCache).toBe(false);
  });
});
