import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  markWorn as _markWorn,
  sendToLaundry as _sendToLaundry,
  markWashed as _markWashed,
  skipForSession as _skipForSession,
  skipForWeek as _skipForWeek,
  softDelete as _softDelete,
  restore as _restore,
  purge as _purge,
} from "@/lib/garmentStatus";
import { Garment, GarmentCategory, GarmentStatus } from "@/lib/types";

// Re-export types so existing imports from this file still work
export type { Garment, GarmentCategory, GarmentStatus };

const STORAGE_KEY = "@fitweek/garments";

export interface ClassifyResponse {
  category: GarmentCategory;
  color: string;
  tags: string[];
  confidence: number;
  matchedLabel: string | null;
}

interface GarmentContextValue {
  garments: Garment[];
  isLoading: boolean;
  addGarment: (
    g: Omit<Garment, "id" | "createdAt" | "wearCount" | "lastWornAt" | "lastSkippedAt" | "skipUntil" | "deletedAt">,
  ) => Promise<Garment>;
  updateGarment: (id: string, patch: Partial<Garment>) => Promise<void>;
  removeGarment: (id: string) => Promise<void>;
  // Status transitions
  markWorn: (id: string) => Promise<void>;
  sendToLaundry: (id: string) => Promise<void>;
  markClean: (id: string) => Promise<void>;
  // Skip
  skipForSession: (id: string) => Promise<void>;
  skipForWeek: (id: string) => Promise<void>;
  // Soft delete
  softDeleteGarment: (id: string) => Promise<void>;
  restoreGarment: (id: string) => Promise<void>;
  purgeGarment: (id: string) => Promise<void>;
  // AI classification
  classifyImage: (params: { imageBase64?: string; imageUrl?: string }) => Promise<ClassifyResponse | null>;
}

const GarmentContext = createContext<GarmentContextValue | null>(null);

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function GarmentProvider({ children }: { children: React.ReactNode }) {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setGarments(JSON.parse(raw) as Garment[]);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const persist = useCallback(async (next: Garment[]) => {
    setGarments(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addGarment = useCallback(
    async (
      data: Omit<Garment, "id" | "createdAt" | "wearCount" | "lastWornAt" | "lastSkippedAt" | "skipUntil" | "deletedAt">,
    ) => {
      const garment: Garment = {
        ...data,
        id: makeId(),
        wearCount: 0,
        lastWornAt: null,
        lastSkippedAt: null,
        skipUntil: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
      };
      await persist([garment, ...garments]);
      return garment;
    },
    [garments, persist],
  );

  const updateGarment = useCallback(
    async (id: string, patch: Partial<Garment>) => {
      await persist(garments.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    },
    [garments, persist],
  );

  // Hard remove (no undo) — kept for programmatic use
  const removeGarment = useCallback(
    async (id: string) => {
      await persist(_purge(garments, id));
    },
    [garments, persist],
  );

  // ── Status transitions ──────────────────────────────────────────────────────

  const markWorn = useCallback(async (id: string) => {
    await persist(_markWorn(garments, id));
  }, [garments, persist]);

  const sendToLaundry = useCallback(async (id: string) => {
    await persist(_sendToLaundry(garments, id));
  }, [garments, persist]);

  const markClean = useCallback(async (id: string) => {
    await persist(_markWashed(garments, id));
  }, [garments, persist]);

  // ── Skip logic ──────────────────────────────────────────────────────────────

  const skipForSession = useCallback(async (id: string) => {
    await persist(_skipForSession(garments, id));
  }, [garments, persist]);

  const skipForWeek = useCallback(async (id: string) => {
    await persist(_skipForWeek(garments, id));
  }, [garments, persist]);

  // ── Soft delete ─────────────────────────────────────────────────────────────

  const softDeleteGarment = useCallback(async (id: string) => {
    await persist(_softDelete(garments, id));
  }, [garments, persist]);

  const restoreGarment = useCallback(async (id: string) => {
    await persist(_restore(garments, id));
  }, [garments, persist]);

  const purgeGarment = useCallback(async (id: string) => {
    await persist(_purge(garments, id));
  }, [garments, persist]);

  // ── AI classification ───────────────────────────────────────────────────────

  const classifyImage = useCallback(
    async (params: { imageBase64?: string; imageUrl?: string }): Promise<ClassifyResponse | null> => {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      if (!domain) return null;
      try {
        const res = await fetch(`https://${domain}/api/garments/classify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        if (!res.ok) return null;
        return (await res.json()) as ClassifyResponse;
      } catch {
        return null;
      }
    },
    [],
  );

  return (
    <GarmentContext.Provider
      value={{
        garments,
        isLoading,
        addGarment,
        updateGarment,
        removeGarment,
        markWorn,
        sendToLaundry,
        markClean,
        skipForSession,
        skipForWeek,
        softDeleteGarment,
        restoreGarment,
        purgeGarment,
        classifyImage,
      }}
    >
      {children}
    </GarmentContext.Provider>
  );
}

export function useGarments(): GarmentContextValue {
  const ctx = useContext(GarmentContext);
  if (!ctx) throw new Error("useGarments must be used within GarmentProvider");
  return ctx;
}
