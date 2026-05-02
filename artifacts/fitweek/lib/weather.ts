/**
 * Weather service — client-side wrapper for the /api/weather/forecast endpoint.
 *
 * Responsibilities:
 *  - Fetch forecast from api-server (which proxies OWM server-side)
 *  - Cache successful responses in AsyncStorage for up to 24 hours
 *  - Fall back to cache when the network request fails
 *  - Report unavailability when both fetch and cache fail
 *
 * Issue 4 TDD — Tests 1-3:
 *   Test 1: success response → days parsed, usingCache=false, weatherUnavailable=false
 *   Test 2: fetch fails, valid cache (< 24h) → days from cache, usingCache=true
 *   Test 3: fetch fails, no cache → days=[], weatherUnavailable=true
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export type WeatherCondition =
  | "clear"
  | "cloudy"
  | "rainy"
  | "snowy"
  | "windy"
  | "thunderstorm";

export interface DailyForecast {
  /** ISO date: YYYY-MM-DD */
  date: string;
  /** °C rounded */
  tempMin: number;
  tempMax: number;
  condition: WeatherCondition;
  /** Human-readable label from OWM e.g. "light rain" */
  conditionLabel: string;
  /** OWM icon code e.g. "01d" */
  icon: string;
  /** Probability of precipitation 0–1 */
  pop: number;
}

export interface ForecastResult {
  days: DailyForecast[];
  usingCache: boolean;
  weatherUnavailable: boolean;
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_PREFIX = "@fitweek/weather_v1_";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  fetchedAt: number;
  days: DailyForecast[];
}

function cacheKey(lat: number, lon: number): string {
  // Round to 0.1° ≈ 11 km — coarse enough to share across short moves
  return `${CACHE_PREFIX}${lat.toFixed(1)}_${lon.toFixed(1)}`;
}

function cityCacheKey(city: string): string {
  return `${CACHE_PREFIX}city_${city.toLowerCase().replace(/\s+/g, "_")}`;
}

async function readCache(key: string): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.fetchedAt > TTL_MS) return null; // expired
    return entry;
  } catch {
    return null;
  }
}

async function writeCache(key: string, days: DailyForecast[]): Promise<void> {
  try {
    const entry: CacheEntry = { fetchedAt: Date.now(), days };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Non-fatal — cache write failure is acceptable
  }
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

function apiBase(baseUrl?: string): string {
  if (baseUrl) return baseUrl;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : "";
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch a 7-day forecast by GPS coordinates.
 * Falls back to AsyncStorage cache when the network call fails.
 */
export async function getWeatherForecast(
  lat: number,
  lon: number,
  /** Override the API base URL — used in tests to avoid real network calls. */
  baseUrl?: string,
): Promise<ForecastResult> {
  const key = cacheKey(lat, lon);

  try {
    const url = `${apiBase(baseUrl)}/api/weather/forecast?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const days = (await res.json()) as DailyForecast[];
    await writeCache(key, days);
    return { days, usingCache: false, weatherUnavailable: false };
  } catch {
    const cached = await readCache(key);
    if (cached) {
      return { days: cached.days, usingCache: true, weatherUnavailable: false };
    }
    return { days: [], usingCache: false, weatherUnavailable: true };
  }
}

/**
 * Fetch a 7-day forecast by city name (server handles geocoding).
 */
export async function getWeatherForecastByCity(
  city: string,
  baseUrl?: string,
): Promise<ForecastResult> {
  const key = cityCacheKey(city);

  try {
    const url = `${apiBase(baseUrl)}/api/weather/forecast?city=${encodeURIComponent(city)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const days = (await res.json()) as DailyForecast[];
    await writeCache(key, days);
    return { days, usingCache: false, weatherUnavailable: false };
  } catch {
    const cached = await readCache(key);
    if (cached) {
      return { days: cached.days, usingCache: true, weatherUnavailable: false };
    }
    return { days: [], usingCache: false, weatherUnavailable: true };
  }
}
