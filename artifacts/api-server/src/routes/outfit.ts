import { Router } from "express";

const router = Router();

// ── Types (mirrors Expo app types) ────────────────────────────────────────────

type GarmentCategory =
  | "tops"
  | "bottoms"
  | "dresses"
  | "outerwear"
  | "shoes"
  | "accessories"
  | "other";

type WeatherCondition =
  | "clear" | "cloudy" | "rainy" | "snowy" | "windy" | "thunderstorm";

interface Garment {
  id: string;
  category: GarmentCategory;
  color: string;
  name: string;
  status: string;
  wearCount: number;
  lastWornAt: string | null;
  lastSkippedAt: string | null;
  skipUntil: string | null;
  deletedAt: string | null;
  createdAt: string;
}

interface DailyForecast {
  date: string;
  tempMin: number;
  tempMax: number;
  condition: WeatherCondition;
}

// ── Suggestion logic ──────────────────────────────────────────────────────────

const COLD_CONDITIONS = new Set<WeatherCondition>(["rainy", "snowy", "thunderstorm", "windy"]);

function isWeatherAppropriate(cat: GarmentCategory, f: DailyForecast | undefined): boolean {
  if (!f) return true;
  const isCold = f.tempMax < 20;
  const isWet = COLD_CONDITIONS.has(f.condition);
  if (cat === "outerwear") return isCold;
  if (cat === "dresses") return f.tempMax >= 15 && !isWet;
  return true;
}

function isCandidateForDate(g: Garment, date: string): boolean {
  if (g.status !== "clean") return false;
  if (g.deletedAt !== null) return false;
  if (g.lastSkippedAt === date) return false;
  if (g.skipUntil && g.skipUntil >= date) return false;
  return true;
}

// Hero priority order: one "star" piece per outfit
const HERO_ORDER: GarmentCategory[] = [
  "dresses", "tops", "bottoms", "outerwear", "shoes", "accessories", "other",
];

// Supporting pieces to round out an outfit
const SUPPORT_CATEGORIES: GarmentCategory[] = ["tops", "bottoms", "shoes", "accessories"];

/**
 * Score a garment for selection: lower score = more desirable.
 * Penalise high wearCount and recent lastWornAt.
 */
function score(g: Garment): number {
  const recencyPenalty = g.lastWornAt
    ? Math.max(0, 7 - daysSince(g.lastWornAt)) // penalise if worn in last 7 days
    : 0;
  return g.wearCount * 2 + recencyPenalty;
}

function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

function pickBest(candidates: Garment[]): Garment | null {
  if (!candidates.length) return null;
  return candidates.slice().sort((a, b) => score(a) - score(b))[0]!;
}

function suggestForDate(
  date: string,
  garments: Garment[],
  forecast: DailyForecast | undefined,
  usedHeroIds: Set<string>,
): string[] {
  const eligible = garments.filter(
    (g) => isCandidateForDate(g, date) && isWeatherAppropriate(g.category, forecast),
  );

  const result: string[] = [];

  // 1. Pick hero garment
  let hero: Garment | null = null;
  for (const cat of HERO_ORDER) {
    const candidates = eligible.filter((g) => g.category === cat && !usedHeroIds.has(g.id));
    hero = pickBest(candidates);
    if (hero) break;
  }
  if (!hero) {
    // Relax hero uniqueness constraint
    for (const cat of HERO_ORDER) {
      const candidates = eligible.filter((g) => g.category === cat);
      hero = pickBest(candidates);
      if (hero) break;
    }
  }
  if (hero) {
    result.push(hero.id);
    usedHeroIds.add(hero.id);
  }

  // 2. Pick supporting pieces — skip categories already covered by hero
  const coveredCats = new Set(result.map((id) => garments.find((g) => g.id === id)?.category));
  for (const cat of SUPPORT_CATEGORIES) {
    if (coveredCats.has(cat)) continue;
    const candidates = eligible.filter((g) => g.category === cat && !result.includes(g.id));
    const pick = pickBest(candidates);
    if (pick) {
      result.push(pick.id);
      coveredCats.add(cat);
    }
  }

  return result;
}

// ── Route ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/outfit/suggest
 *
 * Body: { dates: string[], garments: Garment[], forecasts: DailyForecast[] }
 * Returns: { suggestions: Record<string, string[]> }  — garment IDs per date
 */
router.post("/outfit/suggest", (req, res) => {
  const { dates, garments, forecasts } = req.body as {
    dates?: string[];
    garments?: Garment[];
    forecasts?: DailyForecast[];
  };

  if (!Array.isArray(dates) || !Array.isArray(garments)) {
    return res.status(400).json({ error: "dates and garments arrays are required" });
  }

  const forecastByDate = new Map<string, DailyForecast>(
    (forecasts ?? []).map((f) => [f.date, f]),
  );

  const usedHeroIds = new Set<string>();
  const suggestions: Record<string, string[]> = {};

  for (const date of dates) {
    suggestions[date] = suggestForDate(date, garments, forecastByDate.get(date), usedHeroIds);
  }

  return res.json({ suggestions });
});

export default router;
