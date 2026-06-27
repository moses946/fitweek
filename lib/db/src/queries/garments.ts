import { ne } from "drizzle-orm";
import { garments } from "../schema/garments";

/**
 * activeGarmentsFilter — a reusable Drizzle WHERE condition that excludes
 * soft-deleted garments from any query.
 *
 * ALWAYS compose this into your garment queries using `and()` so that
 * deleted garments are never accidentally returned to callers.
 *
 * @example
 * import { eq, and } from "drizzle-orm";
 * import { db, garments, activeGarmentsFilter } from "@workspace/db";
 *
 * // All active garments for a user
 * const rows = await db
 *   .select()
 *   .from(garments)
 *   .where(and(activeGarmentsFilter, eq(garments.userId, userId)));
 *
 * // Active garments in a specific category
 * const tops = await db
 *   .select()
 *   .from(garments)
 *   .where(and(activeGarmentsFilter, eq(garments.userId, userId), eq(garments.category, "tops")));
 */
export const activeGarmentsFilter = ne(garments.status, "deleted");
