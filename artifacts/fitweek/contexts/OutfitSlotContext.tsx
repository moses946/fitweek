import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { useGarments } from "@/contexts/GarmentContext";
import {
  addGarmentToSlot as _add,
  removeGarmentFromSlot as _remove,
  confirmSlot as _confirm,
  clearSlot as _clear,
  renameSlot as _rename,
  cleanupExpiredDrafts,
  getOrCreateDraftSlot,
  getConfirmedGarmentIds,
  markAllWorn as _markAllWorn,
} from "@/lib/outfitSlots";
import { scheduleSundayPlannerNotification } from "@/lib/outfitSlotNotifications";
import { saveVTOResult as _saveVTO } from "@/lib/vto";
import type { OutfitSlot } from "@/lib/types";

const STORAGE_KEY = "@fitweek/outfit_slots_v1";

interface OutfitSlotContextValue {
  slots: OutfitSlot[];
  isLoading: boolean;
  getSlotForDate: (date: string) => OutfitSlot | undefined;
  getOrCreateDraft: (date: string) => Promise<OutfitSlot>;
  addGarmentToSlot: (slotId: string, garmentId: string) => Promise<void>;
  removeGarmentFromSlot: (slotId: string, garmentId: string) => Promise<void>;
  confirmSlot: (slotId: string) => Promise<void>;
  clearSlot: (slotId: string) => Promise<void>;
  renameSlot: (slotId: string, name: string) => Promise<void>;
  markAllWornInSlot: (slotId: string) => Promise<void>;
  updateSlotVtoImage: (slotId: string, vtoImageUrl: string) => Promise<void>;
  /** IDs of garments locked into confirmed slots (excluding a given date) */
  getConfirmedGarmentIds: (excludeDate?: string) => Set<string>;
}

const OutfitSlotContext = createContext<OutfitSlotContextValue | null>(null);

export function OutfitSlotProvider({ children }: { children: React.ReactNode }) {
  const { garments, markWorn } = useGarments();
  const [slots, setSlots] = useState<OutfitSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load + cleanup on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const loaded: OutfitSlot[] = raw ? (JSON.parse(raw) as OutfitSlot[]) : [];
        const cleaned = cleanupExpiredDrafts(loaded, new Date());
        setSlots(cleaned);
        // Persist cleanup immediately
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned)).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    // Schedule Sunday planner notification (best-effort)
    scheduleSundayPlannerNotification().catch(() => {});
  }, []);

  const persist = useCallback(async (next: OutfitSlot[]) => {
    setSlots(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const getSlotForDate = useCallback(
    (date: string) => slots.find((s) => s.date === date),
    [slots],
  );

  const getOrCreateDraft = useCallback(
    async (date: string): Promise<OutfitSlot> => {
      const { slot, slots: next } = getOrCreateDraftSlot(slots, date);
      if (next !== slots) await persist(next);
      return slot;
    },
    [slots, persist],
  );

  const addGarmentToSlot = useCallback(
    async (slotId: string, garmentId: string) => {
      await persist(_add(slots, slotId, garmentId));
    },
    [slots, persist],
  );

  const removeGarmentFromSlot = useCallback(
    async (slotId: string, garmentId: string) => {
      await persist(_remove(slots, slotId, garmentId));
    },
    [slots, persist],
  );

  const confirmSlot = useCallback(
    async (slotId: string) => {
      await persist(_confirm(slots, slotId, garments));
    },
    [slots, garments, persist],
  );

  const clearSlot = useCallback(
    async (slotId: string) => {
      await persist(_clear(slots, slotId));
    },
    [slots, persist],
  );

  const renameSlot = useCallback(
    async (slotId: string, name: string) => {
      await persist(_rename(slots, slotId, name));
    },
    [slots, persist],
  );

  const markAllWornInSlot = useCallback(
    async (slotId: string) => {
      const slot = slots.find((s) => s.id === slotId);
      if (!slot) return;
      await Promise.all(slot.garmentIds.map((id) => markWorn(id)));
    },
    [slots, markWorn],
  );

  const updateSlotVtoImage = useCallback(
    async (slotId: string, vtoImageUrl: string) => {
      await persist(_saveVTO(slots, slotId, vtoImageUrl));
    },
    [slots, persist],
  );

  const getConfirmedIds = useCallback(
    (excludeDate?: string) => getConfirmedGarmentIds(slots, excludeDate),
    [slots],
  );

  return (
    <OutfitSlotContext.Provider
      value={{
        slots,
        isLoading,
        getSlotForDate,
        getOrCreateDraft,
        addGarmentToSlot,
        removeGarmentFromSlot,
        confirmSlot,
        clearSlot,
        renameSlot,
        markAllWornInSlot,
        updateSlotVtoImage,
        getConfirmedGarmentIds: getConfirmedIds,
      }}
    >
      {children}
    </OutfitSlotContext.Provider>
  );
}

export function useOutfitSlots(): OutfitSlotContextValue {
  const ctx = useContext(OutfitSlotContext);
  if (!ctx)
    throw new Error("useOutfitSlots must be used inside OutfitSlotProvider");
  return ctx;
}
