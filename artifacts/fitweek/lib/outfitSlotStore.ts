/**
 * ApiOutfitSlotStore
 *
 * Replaces the AsyncStorage-backed OutfitSlotStore with server-backed persistence.
 * All reads/writes go through the Express API, authenticated with the Supabase JWT.
 *
 * The local OutfitSlotState still drives React rendering via the subscribe pattern —
 * we just load from and persist to the server instead of AsyncStorage.
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import { SchedulerAdapter, getScheduler, computeNextSundayAt7pm } from "./scheduler";
import { OutfitSlot, Garment, GarmentCategory } from "./types";
import { API_BASE_URL } from "./config";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OutfitSlotState {
  slots: OutfitSlot[];
  isLoading: boolean;
}

export type OutfitSlotListener = (state: OutfitSlotState) => void;

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

const CATEGORY_LABELS: Record<GarmentCategory, string> = {
  tops: "Top",
  bottoms: "Trousers",
  dresses: "Dress",
  outerwear: "Jacket",
  shoes: "Shoes",
  accessories: "Accessories",
  other: "Piece",
};

function autoName(garmentIds: string[], garments: Garment[]): string {
  const seen = new Set<GarmentCategory>();
  const labels: string[] = [];
  for (const id of garmentIds) {
    const g = garments.find((x) => x.id === id);
    if (g && !seen.has(g.category)) {
      seen.add(g.category);
      labels.push(CATEGORY_LABELS[g.category]);
    }
  }
  return labels.length > 0 ? labels.join(" + ") : "Outfit";
}

/** Map a server row (Drizzle outfitSlots) to the local OutfitSlot interface. */
function mapServerSlot(raw: Record<string, unknown>): OutfitSlot {
  return {
    id: raw.id as string,
    date: (raw.plannedDate ?? raw.planned_date) as string,
    garmentIds: (raw.garmentIds ?? raw.garment_ids ?? []) as string[],
    status: (raw.status as OutfitSlot["status"]) ?? "draft",
    name: (raw.notes as string) ?? null,
    createdAt: (raw.createdAt ?? raw.created_at) as string,
    vtoImageUrl: (raw.vtoImageUrl ?? raw.vto_image_url ?? null) as string | null,
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

export class OutfitSlotStore {
  private state: OutfitSlotState = { slots: [], isLoading: true };
  private listeners: Set<OutfitSlotListener> = new Set();
  private scheduler: SchedulerAdapter;

  constructor(schedulerAdapter?: SchedulerAdapter) {
    this.scheduler = schedulerAdapter ?? getScheduler();
  }

  getState(): OutfitSlotState {
    return this.state;
  }

  subscribe(listener: OutfitSlotListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) listener(this.state);
  }

  private patch(slots: OutfitSlot[]) {
    this.state = { ...this.state, slots };
    this.notify();
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async init() {
    try {
      const now = new Date();
      const from = new Date(now);
      from.setDate(now.getDate() - 30);
      const to = new Date(now);
      to.setDate(now.getDate() + 60);

      const fmt = (d: Date) => d.toISOString().split("T")[0]!;
      const res = await apiFetch(`/api/outfit-slots?from=${fmt(from)}&to=${fmt(to)}`);

      if (res.ok) {
        const raw = (await res.json()) as Record<string, unknown>[];
        const slots = raw.map(mapServerSlot);
        this.state = { slots, isLoading: false };
      } else {
        this.state = { slots: [], isLoading: false };
      }

      this.notify();
      this.schedulePlannerReminder();
    } catch {
      this.state = { slots: [], isLoading: false };
      this.notify();
    }
  }

  private schedulePlannerReminder() {
    const nextSunday = computeNextSundayAt7pm(new Date());
    this.scheduler
      .schedule({
        id: "sunday-planner-reminder",
        namespace: "planner",
        title: "Plan your week",
        body: "Sunday evening — a great time to plan next week's outfits!",
        triggerDate: nextSunday,
      })
      .catch(() => {});
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  getSlotForDate(date: string): OutfitSlot | undefined {
    return this.state.slots.find((s) => s.date === date);
  }

  getConfirmedGarmentIds(excludeDate?: string): Set<string> {
    const ids = new Set<string>();
    for (const s of this.state.slots) {
      if (s.status === "confirmed" && s.date !== excludeDate) {
        for (const id of s.garmentIds) ids.add(id);
      }
    }
    return ids;
  }

  // ── Mutations (write-through: optimistic local update + server persist) ──────

  async createDraft(date: string): Promise<OutfitSlot> {
    const existing = this.state.slots.find((s) => s.date === date && s.status === "draft");
    if (existing) return existing;

    const res = await apiFetch("/api/outfit-slots", {
      method: "POST",
      body: JSON.stringify({ plannedDate: date, garmentIds: [], status: "draft" }),
    });

    if (!res.ok) throw new Error(`createDraft failed: ${res.status}`);
    const raw = (await res.json()) as Record<string, unknown>;
    const slot = mapServerSlot(raw);

    this.patch([...this.state.slots, slot]);
    return slot;
  }

  async addGarment(slotId: string, garmentId: string): Promise<void> {
    const slot = this.state.slots.find((s) => s.id === slotId);
    if (!slot || slot.garmentIds.includes(garmentId)) return;

    const next = [...slot.garmentIds, garmentId];
    await this._patchSlot(slotId, { garmentIds: next });
  }

  async removeGarment(slotId: string, garmentId: string): Promise<void> {
    const slot = this.state.slots.find((s) => s.id === slotId);
    if (!slot) return;

    const next = slot.garmentIds.filter((id) => id !== garmentId);
    await this._patchSlot(slotId, { garmentIds: next });
  }

  async confirmSlot(slotId: string, garments: Garment[]): Promise<void> {
    const slot = this.state.slots.find((s) => s.id === slotId);
    if (!slot) return;

    const name = slot.name ?? autoName(slot.garmentIds, garments);
    await this._patchSlot(slotId, { status: "confirmed", notes: name });
  }

  async clearSlot(slotId: string): Promise<void> {
    const res = await apiFetch(`/api/outfit-slots/${slotId}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`clearSlot failed: ${res.status}`);
    this.patch(this.state.slots.filter((s) => s.id !== slotId));
  }

  async renameSlot(slotId: string, name: string): Promise<void> {
    await this._patchSlot(slotId, { notes: name });
  }

  async saveVtoResult(slotId: string, vtoImageUrl: string): Promise<void> {
    // VTO URL is stored in-memory only; the vto_results table is the canonical store
    this.patch(
      this.state.slots.map((s) =>
        s.id === slotId ? { ...s, vtoImageUrl } : s,
      ),
    );
  }

  async markAllWorn(slotId: string): Promise<string[]> {
    const slot = this.state.slots.find((s) => s.id === slotId);
    return slot ? [...slot.garmentIds] : [];
  }

  async bulkImport(suggestions: Record<string, string[]>): Promise<OutfitSlot[]> {
    const res = await apiFetch("/api/outfit-slots/bulk", {
      method: "POST",
      body: JSON.stringify({ suggestions }),
    });

    if (!res.ok) throw new Error(`bulkImport failed: ${res.status}`);
    const raw = (await res.json()) as Record<string, unknown>[];
    const newSlots = raw.map(mapServerSlot);

    // Merge into local state (overwrite same-date drafts, keep confirmed)
    const existingDates = new Set(newSlots.map((s) => s.date));
    const kept = this.state.slots.filter(
      (s) => !existingDates.has(s.date) || s.status === "confirmed",
    );
    this.patch([...kept, ...newSlots]);
    return newSlots;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async _patchSlot(
    slotId: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    // Optimistic update
    this.patch(
      this.state.slots.map((s) =>
        s.id === slotId
          ? {
              ...s,
              ...(body.garmentIds !== undefined ? { garmentIds: body.garmentIds as string[] } : {}),
              ...(body.status !== undefined ? { status: body.status as OutfitSlot["status"] } : {}),
              ...(body.notes !== undefined ? { name: body.notes as string } : {}),
            }
          : s,
      ),
    );

    const res = await apiFetch(`/api/outfit-slots/${slotId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // Revert on failure by re-fetching from server
      await this.init();
      throw new Error(`_patchSlot failed: ${res.status}`);
    }
  }
}
