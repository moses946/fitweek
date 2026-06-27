export type GarmentCategory =
  | "tops"
  | "bottoms"
  | "dresses"
  | "outerwear"
  | "shoes"
  | "accessories"
  | "other";

export type GarmentStatus = "active" | "laundry" | "deleted";

export type WeatherCondition =
  | "clear"
  | "cloudy"
  | "rainy"
  | "snowy"
  | "windy"
  | "thunderstorm";

export interface Garment {
  id: string;
  imageUrl: string;
  category: GarmentCategory;
  color: string;
  tags: string[];
  name: string;
  status: GarmentStatus;
  wearCount: number;
  lastWornAt: string | null;
  lastSkippedAt: string | null;
  skipUntil: string | null;
  deletedAt: string | null;
  createdAt: string;
  aiDescription?: string | null;
}

export interface DailyForecast {
  date: string;
  tempMin: number;
  tempMax: number;
  condition: WeatherCondition;
  conditionLabel?: string;
  icon?: string;
  pop?: number;
}

export interface GarmentScoreBreakdown {
  recency: number;
  weatherFit: number;
  freshness: number;
  variety: number;
  tagFit: number;
  colorNeutral: number;
}

export interface OutfitCohesionBreakdown {
  completeness: number;
  outerwearFit: number;
  colorHarmony: number;
  categoryCoverage: number;
}

export interface OutfitBreakdown {
  garments: GarmentScoreBreakdown;
  cohesion: OutfitCohesionBreakdown;
}

export interface DayRecommendation {
  outfitIds: string[];
  deck: string[];
  score: number;
  breakdown: OutfitBreakdown;
}

export interface GarmentWeights {
  recency: number;
  weatherFit: number;
  freshness: number;
  variety: number;
  tagFit: number;
  colorNeutral: number;
}

export interface EngineConfig {
  enableWeatherFiltering?: boolean;
  weights?: Partial<GarmentWeights>;
  topPerSlot?: number;
  maxCandidates?: number;
}

export interface RecommendInput {
  date: string;
  garments: Garment[];
  forecast: DailyForecast | null;
  plannedGarmentIds?: string[];
  today?: Date;
  config?: EngineConfig;
}

export interface WeekRecommendInput {
  dates: string[];
  garments: Garment[];
  forecasts: Map<string, DailyForecast>;
  alreadyPlanned?: Map<string, string[]>;
  today?: Date;
  config?: EngineConfig;
}

export interface ScoredGarment {
  garment: Garment;
  score: number;
  breakdown: GarmentScoreBreakdown;
}

export interface ScoredOutfit {
  garments: Garment[];
  score: number;
  breakdown: OutfitBreakdown;
}
