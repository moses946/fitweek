import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { SuggestionEngine, ClassifierAdapter } from "../lib/suggestionEngine";
import { ApiGarmentRepository } from "../lib/garmentRepository";
import { Garment, GarmentCategory, GarmentStatus } from "../lib/types";
import { API_BASE_URL } from "../lib/config";

export type { Garment, GarmentCategory, GarmentStatus };

export interface ClassifyResponse {
  category: GarmentCategory;
  color: string;
  tags: string[];
  confidence: number;
  matchedLabel: string | null;
  /**
   * Base64-encoded PNG with background removed (no data URI prefix).
   * Present only when the server successfully removed the background.
   */
  processedImageBase64?: string;
}

class ApiClassifierAdapter implements ClassifierAdapter {
  async classifyImage(uri: string): Promise<{ category: GarmentCategory; description: string }> {
    const apiBase = API_BASE_URL;
    try {
      const isUrl = uri.startsWith("http");
      const body = JSON.stringify(isUrl ? { imageUrl: uri } : { imageBase64: uri });
      const res = await fetch(`${apiBase}/api/garments/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) throw new Error("Classification failed");
      const data = await res.json() as ClassifyResponse;
      return { category: data.category, description: data.matchedLabel ?? "" };
    } catch {
      return { category: "other", description: "" };
    }
  }
}

interface GarmentContextValue {
  garments: Garment[];
  isLoading: boolean;
  /** True while any garment mutation (mark, delete, save) is in-flight. */
  operationPending: boolean;
  addGarment: (g: Omit<Garment, "id" | "createdAt" | "wearCount" | "lastWornAt" | "lastSkippedAt" | "skipUntil" | "deletedAt">) => Promise<Garment>;
  updateGarment: (id: string, patch: Partial<Garment>) => Promise<void>;
  removeGarment: (id: string) => Promise<void>;
  markWorn: (id: string) => Promise<void>;
  sendToLaundry: (id: string) => Promise<void>;
  markClean: (id: string) => Promise<void>;
  skipForSession: (id: string) => Promise<void>;
  skipForWeek: (id: string) => Promise<void>;
  softDeleteGarment: (id: string) => Promise<void>;
  restoreGarment: (id: string) => Promise<void>;
  purgeGarment: (id: string) => Promise<void>;
  classifyImage: (params: { imageBase64?: string; imageUrl?: string }) => Promise<ClassifyResponse | null>;
}

const GarmentContext = createContext<GarmentContextValue | null>(null);
const repo = new ApiGarmentRepository();
const engine = new SuggestionEngine(repo, new ApiClassifierAdapter());

export function GarmentProvider({ children }: { children: React.ReactNode }) {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [operationPending, setOperationPending] = useState(false);

  const refresh = useCallback(async () => {
    const loaded = await repo.getGarments();
    setGarments(loaded);
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  const addGarment = useCallback(async (data: any) => {
    const g = await repo.add(data);
    await refresh();
    return g;
  }, [refresh]);

  const updateGarment = useCallback(async (id: string, patch: Partial<Garment>) => {
    const gs = await repo.getGarments();
    const existing = gs.find(x => x.id === id);
    if (existing) {
      await repo.saveGarment({ ...existing, ...patch });
      await refresh();
    }
  }, [refresh]);

  const removeGarment = useCallback(async (id: string) => {
    await engine.applyAction(id, "purge");
    await refresh();
  }, [refresh]);

  const applyActionAndRefresh = useCallback(async (id: string, action: Parameters<SuggestionEngine["applyAction"]>[1]) => {
    setOperationPending(true);
    try {
      await engine.applyAction(id, action, new Date());
      await refresh();
    } finally {
      setOperationPending(false);
    }
  }, [refresh]);


  const classifyImage = useCallback(async (params: { imageBase64?: string; imageUrl?: string }): Promise<ClassifyResponse | null> => {
    const apiBase = API_BASE_URL;
    try {
      const res = await fetch(`${apiBase}/api/garments/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) return null;
      return await res.json() as ClassifyResponse;
    } catch {
      return null;
    }
  }, []);

  return (
    <GarmentContext.Provider
      value={{
        garments,
        isLoading,
        operationPending,
        addGarment,
        updateGarment,
        removeGarment,
        markWorn: (id) => applyActionAndRefresh(id, "markWorn"),
        sendToLaundry: (id) => applyActionAndRefresh(id, "sendToLaundry"),
        markClean: (id) => applyActionAndRefresh(id, "markWashed"),
        skipForSession: (id) => applyActionAndRefresh(id, "skipSession"),
        skipForWeek: (id) => applyActionAndRefresh(id, "skipWeek"),
        softDeleteGarment: (id) => applyActionAndRefresh(id, "softDelete"),
        restoreGarment: (id) => applyActionAndRefresh(id, "restore"),
        purgeGarment: (id) => applyActionAndRefresh(id, "purge"),
        classifyImage,
      }}
    >
      {children}
    </GarmentContext.Provider>
  );
}

export function useGarments() {
  const ctx = useContext(GarmentContext);
  if (!ctx) throw new Error("useGarments must be used within GarmentProvider");
  return ctx;
}
