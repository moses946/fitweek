/**
 * Issue 4 — Weather Service
 *
 * Thin wrapper around OpenWeatherMap One Call API 3.0.
 * Caches the last successful response in AsyncStorage (24-hour TTL).
 * On fetch failure, falls back to cache; if cache is empty, returns weatherUnavailable.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "@fitweek/weather_cache";
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type WeatherConditionName =
  | "clear"
  | "cloudy"
  | "rain"
  | "snow"
  | "storm"
  | "fog";

export interface DailyForecast {
  /** ISO date string, YYYY-MM-DD */
  date: string;
  /** °C */
  tempMin: number;
  /** °C */
  tempMax: number;
  condition: WeatherConditionName;
  /** Raw OWM weather code */
  conditionCode: number;
  description: string;
  /** Relative humidity % */
  humidity: number;
  /** Probability of precipitation, 0–1 */
  pop: number;
}

export interface WeatherResult {
  forecasts: DailyForecast[];
  fetchedAt: string;
  city?: string;
  usingCache: boolean;
  weatherUnavailable: boolean;
}

interface WeatherCache {
  forecasts: DailyForecast[];
  fetchedAt: string;
  city?: string;
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

export function conditionFromCode(code: number): WeatherConditionName {
  if (code >= 200 && code < 300) return "storm";
  if (code >= 300 && code < 600) return "rain";
  if (code >= 600 && code < 700) return "snow";
  if (code >= 700 && code < 800) return "fog";
  if (code === 800) return "clear";
  return "cloudy";
}

function unixToDateString(unixTs: number): string {
  return new Date(unixTs * 1000).toISOString().split("T")[0]!;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseOWMDay(day: any): DailyForecast {
  const code = (day.weather[0].id ?? 800) as number;
  return {
    date: unixToDateString(day.dt as number),
    tempMin: Math.round((day.temp?.min ?? 15) as number),
    tempMax: Math.round((day.temp?.max ?? 20) as number),
    condition: conditionFromCode(code),
    conditionCode: code,
    description: (day.weather[0].description ?? "") as string,
    humidity: (day.humidity ?? 50) as number,
    pop: (day.pop ?? 0) as number,
  };
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

export async function readWeatherCache(): Promise<WeatherCache | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as WeatherCache;
    const ageMs = Date.now() - new Date(cache.fetchedAt).getTime();
    if (ageMs > CACHE_TTL_MS) return null; // expired
    return cache;
  } catch {
    return null;
  }
}

export async function writeWeatherCache(cache: WeatherCache): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Non-fatal: cache write failure just means next launch will re-fetch
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches a 7-day daily weather forecast from OWM One Call API 3.0.
 * Falls back to AsyncStorage cache on failure.
 */
export async function getWeatherForecast(
  lat: number,
  lon: number,
  apiKey: string,
): Promise<WeatherResult> {
  try {
    const url =
      `https://api.openweathermap.org/data/3.0/onecall` +
      `?lat=${lat}&lon=${lon}` +
      `&exclude=current,minutely,hourly,alerts` +
      `&appid=${apiKey}&units=metric`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`OWM responded with status ${res.status}`);

    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const forecasts: DailyForecast[] = (json.daily as any[])
      .slice(0, 7)
      .map(parseOWMDay);

    const fetchedAt = new Date().toISOString();
    await writeWeatherCache({ forecasts, fetchedAt });

    return { forecasts, fetchedAt, usingCache: false, weatherUnavailable: false };
  } catch {
    const cache = await readWeatherCache();
    if (cache) {
      return {
        forecasts: cache.forecasts,
        fetchedAt: cache.fetchedAt,
        city: cache.city,
        usingCache: true,
        weatherUnavailable: false,
      };
    }
    return {
      forecasts: [],
      fetchedAt: new Date().toISOString(),
      usingCache: false,
      weatherUnavailable: true,
    };
  }
}

/**
 * Geocodes a city name then fetches the forecast.
 */
export async function getWeatherByCity(
  city: string,
  apiKey: string,
): Promise<WeatherResult> {
  try {
    const geoUrl =
      `https://api.openweathermap.org/geo/1.0/direct` +
      `?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`;

    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) throw new Error(`Geocoding failed with status ${geoRes.status}`);

    const geo = (await geoRes.json()) as Array<{
      lat: number;
      lon: number;
      name: string;
    }>;
    if (!geo || geo.length === 0) throw new Error("City not found");

    const { lat, lon, name } = geo[0]!;
    const result = await getWeatherForecast(lat, lon, apiKey);
    return { ...result, city: name };
  } catch {
    const cache = await readWeatherCache();
    if (cache) {
      return { ...cache, usingCache: true, weatherUnavailable: false };
    }
    return {
      forecasts: [],
      fetchedAt: new Date().toISOString(),
      usingCache: false,
      weatherUnavailable: true,
    };
  }
}
