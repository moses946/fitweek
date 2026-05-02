/**
 * Shared domain types for FitWeek.
 * Imported by lib/, contexts/, and __tests__ — never import from contexts here.
 */

export type GarmentCategory =
  | "tops"
  | "bottoms"
  | "dresses"
  | "outerwear"
  | "shoes"
  | "accessories"
  | "other";

export type GarmentStatus = "clean" | "worn" | "laundry";

export type OutfitSlotStatus = "draft" | "confirmed";

export interface OutfitSlot {
  id: string;
  /** ISO date: YYYY-MM-DD */
  date: string;
  garmentIds: string[];
  status: OutfitSlotStatus;
  /** null = auto-generate from garment categories at confirm time */
  name: string | null;
  createdAt: string;
  /** URL of VTO result image stored in Supabase Storage; null until generated */
  vtoImageUrl?: string | null;
}

export interface Garment {
  id: string;
  imageUri: string;
  category: GarmentCategory;
  color: string;
  tags: string[];
  name: string;
  status: GarmentStatus;
  wearCount: number;
  lastWornAt: string | null;
  /** ISO date (YYYY-MM-DD). Set by skipForSession; excludes from suggestions that day. */
  lastSkippedAt: string | null;
  /** ISO date (YYYY-MM-DD). Set by skipForWeek; excludes from suggestions until this date. */
  skipUntil: string | null;
  /** ISO datetime. Set by softDelete; null means the garment is live. */
  deletedAt: string | null;
  createdAt: string;
  /** Natural-language description from Vision LLM — used as VTO prompt input. */
  aiDescription?: string | null;
}
