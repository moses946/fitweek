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
}
