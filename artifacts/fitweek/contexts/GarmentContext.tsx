import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "@fitweek/garments";

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
  createdAt: string;
}

export interface ClassifyResponse {
  category: GarmentCategory;
  color: string;
  tags: string[];
  confidence: number;
}

interface GarmentContextValue {
  garments: Garment[];
  isLoading: boolean;
  addGarment: (g: Omit<Garment, "id" | "createdAt" | "wearCount" | "lastWornAt">) => Promise<Garment>;
  updateGarment: (id: string, patch: Partial<Garment>) => Promise<void>;
  removeGarment: (id: string) => Promise<void>;
  markWorn: (id: string) => Promise<void>;
  sendToLaundry: (id: string) => Promise<void>;
  markClean: (id: string) => Promise<void>;
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
    async (data: Omit<Garment, "id" | "createdAt" | "wearCount" | "lastWornAt">) => {
      const garment: Garment = {
        ...data,
        id: makeId(),
        wearCount: 0,
        lastWornAt: null,
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

  const removeGarment = useCallback(
    async (id: string) => {
      await persist(garments.filter((g) => g.id !== id));
    },
    [garments, persist],
  );

  const markWorn = useCallback(
    async (id: string) => {
      await persist(
        garments.map((g) =>
          g.id === id
            ? {
                ...g,
                status: "worn" as GarmentStatus,
                wearCount: g.wearCount + 1,
                lastWornAt: new Date().toISOString(),
              }
            : g,
        ),
      );
    },
    [garments, persist],
  );

  const sendToLaundry = useCallback(
    async (id: string) => {
      await persist(
        garments.map((g) => (g.id === id ? { ...g, status: "laundry" as GarmentStatus } : g)),
      );
    },
    [garments, persist],
  );

  const markClean = useCallback(
    async (id: string) => {
      await persist(
        garments.map((g) => (g.id === id ? { ...g, status: "clean" as GarmentStatus } : g)),
      );
    },
    [garments, persist],
  );

  const classifyImage = useCallback(
    async (params: {
      imageBase64?: string;
      imageUrl?: string;
    }): Promise<ClassifyResponse | null> => {
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
