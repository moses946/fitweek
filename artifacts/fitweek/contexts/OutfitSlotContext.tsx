import React, { createContext, useContext, useEffect, useState } from "react";
import { OutfitSlotStore, OutfitSlotState } from "../lib/outfitSlotStore";
import { useGarments } from "./GarmentContext";
import { OutfitSlot } from "../lib/types";

export interface OutfitSlotContextValue extends OutfitSlotState {
  getSlotForDate: (date: string) => OutfitSlot | undefined;
  getOrCreateDraft: (date: string) => Promise<OutfitSlot>;
  addGarmentToSlot: (slotId: string, garmentId: string) => Promise<void>;
  removeGarmentFromSlot: (slotId: string, garmentId: string) => Promise<void>;
  confirmSlot: (slotId: string) => Promise<void>;
  clearSlot: (slotId: string) => Promise<void>;
  renameSlot: (slotId: string, name: string) => Promise<void>;
  markAllWornInSlot: (slotId: string) => Promise<void>;
  updateSlotVtoImage: (slotId: string, vtoImageUrl: string) => Promise<void>;
  getConfirmedGarmentIds: (excludeDate?: string) => Set<string>;
  bulkWriteDrafts: (suggestions: Record<string, string[]>) => Promise<OutfitSlot[]>;
}

const OutfitSlotContext = createContext<OutfitSlotContextValue | null>(null);

const store = new OutfitSlotStore();

export function OutfitSlotProvider({ children }: { children: React.ReactNode }) {
  const { garments, markWorn } = useGarments();
  const [state, setState] = useState<OutfitSlotState>(store.getState());

  useEffect(() => {
    store.init();
    return store.subscribe(setState);
  }, []);

  const value: OutfitSlotContextValue = {
    ...state,
    getSlotForDate: (date) => store.getSlotForDate(date),
    getOrCreateDraft: (date) => store.createDraft(date),
    addGarmentToSlot: (slotId, garmentId) => store.addGarment(slotId, garmentId),
    removeGarmentFromSlot: (slotId, garmentId) => store.removeGarment(slotId, garmentId),
    confirmSlot: (slotId) => store.confirmSlot(slotId, garments),
    clearSlot: (slotId) => store.clearSlot(slotId),
    renameSlot: (slotId, name) => store.renameSlot(slotId, name),
    updateSlotVtoImage: (slotId, url) => store.saveVtoResult(slotId, url),
    getConfirmedGarmentIds: (excludeDate) => store.getConfirmedGarmentIds(excludeDate),
    bulkWriteDrafts: (suggestions) => store.bulkImport(suggestions),
    markAllWornInSlot: async (slotId) => {
      const ids = await store.markAllWorn(slotId);
      await Promise.all(ids.map(markWorn));
    }
  };

  return <OutfitSlotContext.Provider value={value}>{children}</OutfitSlotContext.Provider>;
}

export function useOutfitSlots() {
  const ctx = useContext(OutfitSlotContext);
  if (!ctx) throw new Error("useOutfitSlots must be used inside OutfitSlotProvider");
  return ctx;
}
