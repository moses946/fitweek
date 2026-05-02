import { Router } from "express";

const router = Router();

type WeatherCondition =
  | "clear" | "cloudy" | "rainy" | "snowy" | "windy" | "thunderstorm";

const OWM_MAIN_TO_CONDITION: Record<string, WeatherCondition> = {
  Clear: "clear",
  Clouds: "cloudy",
  Rain: "rainy",
  Drizzle: "rainy",
  Thunderstorm: "thunderstorm",
  Snow: "snowy",
  Mist: "cloudy",
  Fog: "cloudy",
  Haze: "cloudy",
  Smoke: "cloudy",
  Dust: "cloudy",
  Sand: "cloudy",
  Squall: "windy",
  Tornado: "windy",
};

interface OWMForecastItem {
  dt: number;
  main: { temp: number; temp_min: number; temp_max: number };
  weather: { main: string; description: string; icon: string }[];
  pop?: number;
}

interface OWMForecastResponse {
  list: OWMForecastItem[];
}

interface OWMGeoItem {
  lat: number;
  lon: number;
  name: string;
}

/**
 * GET /api/weather/forecast
 * Query params: lat + lon  OR  city
 * Proxies to OWM 5-day/3-hour forecast, aggregates to daily.
 * Uses OWM_API_KEY env var (server-side only, never exposed to client).
 */
router.get("/weather/forecast", async (req, res) => {
  const key = process.env.OWM_API_KEY;
  if (!key) {
    return res
      .status(503)
      .json({ error: "Weather service not configured — set OWM_API_KEY" });
  }

  const { lat, lon, city } = req.query as Record<string, string | undefined>;

  let latNum: number;
  let lonNum: number;

  if (city) {
    // Geocode city → lat/lon via OWM geocoding API
    const geoUrl =
      `https://api.openweathermap.org/geo/1.0/direct` +
      `?q=${encodeURIComponent(city)}&limit=1&appid=${key}`;

    try {
      const geoRes = await fetch(geoUrl);
      if (!geoRes.ok) throw new Error(`Geocoding HTTP ${geoRes.status}`);
      const geoData = (await geoRes.json()) as OWMGeoItem[];
      if (!geoData.length) {
        return res.status(404).json({ error: "City not found" });
      }
      latNum = geoData[0]!.lat;
      lonNum = geoData[0]!.lon;
    } catch (err) {
      req.log.error({ err }, "OWM geocoding failed");
      return res.status(502).json({ error: "Geocoding service error" });
    }
  } else if (lat && lon) {
    latNum = parseFloat(lat);
    lonNum = parseFloat(lon);
    if (isNaN(latNum) || isNaN(lonNum)) {
      return res.status(400).json({ error: "Invalid lat/lon values" });
    }
  } else {
    return res.status(400).json({ error: "Provide lat+lon or city" });
  }

  // Fetch 5-day 3-hour forecast (free tier, cnt=56 = 7 days × 8 slots)
  const forecastUrl =
    `https://api.openweathermap.org/data/2.5/forecast` +
    `?lat=${latNum}&lon=${lonNum}&units=metric&cnt=56&appid=${key}`;

  let forecastData: OWMForecastResponse;
  try {
    const fRes = await fetch(forecastUrl);
    if (!fRes.ok) {
      const body = await fRes.text();
      req.log.error({ status: fRes.status, body }, "OWM forecast error");
      return res.status(502).json({ error: "Weather data unavailable" });
    }
    forecastData = (await fRes.json()) as OWMForecastResponse;
  } catch (err) {
    req.log.error({ err }, "OWM fetch failed");
    return res.status(502).json({ error: "Weather service unreachable" });
  }

  // Aggregate 3-hour slots → daily forecasts
  type DayBucket = {
    temps: number[];
    conditions: string[];
    descs: string[];
    icons: string[];
    pops: number[];
  };

  const dailyMap = new Map<string, DayBucket>();

  for (const item of forecastData.list) {
    const date = new Date(item.dt * 1000).toISOString().split("T")[0]!;
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        temps: [],
        conditions: [],
        descs: [],
        icons: [],
        pops: [],
      });
    }
    const bucket = dailyMap.get(date)!;
    bucket.temps.push(item.main.temp);
    bucket.conditions.push(item.weather[0]?.main ?? "Clouds");
    bucket.descs.push(item.weather[0]?.description ?? "cloudy");
    bucket.icons.push(item.weather[0]?.icon ?? "03d");
    bucket.pops.push(item.pop ?? 0);
  }

  const days = Array.from(dailyMap.entries())
    .slice(0, 7)
    .map(([date, b]) => {
      const tempMin = Math.round(Math.min(...b.temps));
      const tempMax = Math.round(Math.max(...b.temps));

      // Most frequent OWM condition in this day's slots
      const condCount = new Map<string, number>();
      for (const c of b.conditions) {
        condCount.set(c, (condCount.get(c) ?? 0) + 1);
      }
      const topCond = [...condCount.entries()].sort((a, b) => b[1] - a[1])[0]![0];
      const condition: WeatherCondition =
        OWM_MAIN_TO_CONDITION[topCond] ?? "cloudy";

      const midIdx = Math.floor(b.descs.length / 2);
      const conditionLabel = b.descs[midIdx] ?? topCond.toLowerCase();
      const icon = b.icons[midIdx] ?? "03d";
      const pop = Math.max(...b.pops);

      return { date, tempMin, tempMax, condition, conditionLabel, icon, pop };
    });

  return res.json(days);
});

export default router;
