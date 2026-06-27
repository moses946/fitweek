/**
 * ApiGarmentRepository
 *
 * Replaces StorageGarmentRepository (AsyncStorage) with server-backed persistence.
 * All operations call the Express API via the Supabase session token for auth.
 *
 * The mobile app already authenticates through Supabase; we forward that same
 * JWT in the Authorization header so the server can verify it with requireAuth.
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import { Garment, GarmentStatus } from "./types";
import { GarmentRepository } from "./suggestionEngine";
import { API_BASE_URL } from "./config";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getBearerToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getBearerToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers ?? {}),
  };
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}

// ── Server shape → local Garment type mapping ─────────────────────────────────

/**
 * The server returns snake_case or camelCase Drizzle columns.
 * We map them to the local Garment interface used throughout the app.
 */
function mapServerGarment(raw: Record<string, unknown>): Garment {
  return {
    id: raw.id as string,
    name: raw.name as string,
    category: raw.category as Garment["category"],
    color: (raw.color as string) ?? "",
    tags: (raw.tags as string[]) ?? [],
    imageUrl: (raw.imageUrl ?? raw.image_url) as string,
    bgRemovedUrl: ((raw.bgRemovedUrl ?? raw.bg_removed_url) as string) ?? null,
    status: (raw.status as GarmentStatus) ?? "active",
    wearCount: (raw.wearCount ?? raw.wear_count ?? 0) as number,
    lastWornAt: ((raw.lastWornAt ?? raw.last_worn_at) as string) ?? null,
    lastSkippedAt: null,
    skipUntil: null,
    deletedAt: ((raw.deletedAt ?? raw.deleted_at) as string) ?? null,
    createdAt: (raw.createdAt ?? raw.created_at) as string,
  };
}

// ── Repository ────────────────────────────────────────────────────────────────

export class ApiGarmentRepository implements GarmentRepository {
  async getGarments(): Promise<Garment[]> {
    try {
      const res = await apiFetch("/api/garments");
      if (!res.ok) throw new Error(`GET /api/garments → ${res.status}`);
      const raw = (await res.json()) as Record<string, unknown>[];
      return raw.map(mapServerGarment);
    } catch (err) {
      console.warn("[ApiGarmentRepository] getGarments failed", err);
      return [];
    }
  }

  async saveGarment(g: Garment): Promise<void> {
    // PATCH if the garment already has a server-issued UUID (36-char), POST otherwise
    const isNew = !g.id || g.id.length < 20;
    if (isNew) {
      await this.add(g);
    } else {
      const res = await apiFetch(`/api/garments/${g.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: g.name,
          category: g.category,
          color: g.color,
          tags: g.tags,
          imageUrl: g.imageUrl,
          bgRemovedUrl: g.bgRemovedUrl,
          status: g.status,
          wearCount: g.wearCount,
          lastWornAt: g.lastWornAt,
        }),
      });
      if (!res.ok) throw new Error(`PATCH /api/garments/${g.id} → ${res.status}`);
    }
  }

  async saveGarments(gs: Garment[]): Promise<void> {
    await Promise.all(gs.map((g) => this.saveGarment(g)));
  }

  async deleteGarment(id: string): Promise<void> {
    const res = await apiFetch(`/api/garments/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`DELETE /api/garments/${id} → ${res.status}`);
  }

  async add(
    data: Omit<Garment, "id" | "createdAt" | "wearCount" | "lastWornAt" | "lastSkippedAt" | "skipUntil" | "deletedAt">,
  ): Promise<Garment> {
    const res = await apiFetch("/api/garments", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        category: data.category,
        color: data.color ?? "",
        tags: data.tags ?? [],
        imageUrl: data.imageUrl,
        bgRemovedUrl: data.bgRemovedUrl ?? null,
        status: data.status ?? "active",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`POST /api/garments → ${res.status}: ${err}`);
    }

    const raw = (await res.json()) as Record<string, unknown>;
    return mapServerGarment(raw);
  }
}
