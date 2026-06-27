import { Garment, GarmentCategory } from "./types";
import { StorageAdapter, getAdapter as getStorageAdapter } from "./storage";
import { CustomFetchFn, createApiClient } from "../../../lib/api-client-react/src/custom-fetch";

export type VtoErrorCode = "VTO_NETWORK" | "VTO_SERVER" | "VTO_TIMEOUT" | "VTO_FILESYSTEM" | "VTO_UNKNOWN";

export class VtoError extends Error {
  constructor(public readonly code: VtoErrorCode, message: string) {
    super(message);
    this.name = "VtoError";
  }
}

export type VtoResult = 
  | { type: "localUri"; uri: string }
  | { type: "remoteUrl"; url: string }
  | { type: "error"; error: VtoError };

export interface VtoInput {
  modelImageUrl: string | null;
  modelBase64?: string;
  garmentBase64: string;
  garmentDescription: string;
}

export interface VtoOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
}

export interface NetworkAdapter {
  fetch: CustomFetchFn;
}

const HERO_PRIORITY: GarmentCategory[] = [
  "dresses", "tops", "bottoms", "outerwear", "shoes", "accessories", "other",
];

export function selectHeroGarment(garments: Garment[]): Garment | null {
  if (garments.length === 0) return null;
  for (const category of HERO_PRIORITY) {
    const found = garments.find((g) => g.category === category);
    if (found) return found;
  }
  return garments[0];
}

export class VTOOrchestrator {
  private network: NetworkAdapter;
  private storage: StorageAdapter;
  private defaultTimeoutMs: number;
  private defaultRetries: number;

  constructor(
    network?: NetworkAdapter,
    storageAdapter?: StorageAdapter,
    defaults?: { timeoutMs?: number; retries?: number }
  ) {
    this.network = network || { fetch: createApiClient() };
    this.storage = storageAdapter || getStorageAdapter();
    this.defaultTimeoutMs = defaults?.timeoutMs ?? 120_000;
    this.defaultRetries = defaults?.retries ?? 0;
  }

  configureDefaults(defaults: { timeoutMs?: number; retries?: number }) {
    if (defaults.timeoutMs !== undefined) this.defaultTimeoutMs = defaults.timeoutMs;
    if (defaults.retries !== undefined) this.defaultRetries = defaults.retries;
  }

  private async attemptVTO(input: VtoInput, options: VtoOptions): Promise<VtoResult> {
    const { modelImageUrl, modelBase64, garmentBase64, garmentDescription } = input;
    if (!modelImageUrl && !modelBase64) {
      return { type: "error", error: new VtoError("VTO_UNKNOWN", "No model image provided") };
    }

    const payload: Record<string, string> = { garmentBase64, garmentDescription };
    if (modelBase64) payload.modelBase64 = modelBase64;
    else if (modelImageUrl) payload.modelImageUrl = modelImageUrl;

    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const abortHandler = () => controller.abort();
    if (options.signal) options.signal.addEventListener("abort", abortHandler);

    try {
      const response = await this.network.fetch<{ resultUrl?: string; resultBase64?: string }>(
        "/api/vto/tryon",
        {
          method: "POST",
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      if (response.resultBase64) {
        try {
          const cacheKey = `vto_cache_${Date.now()}`;
          await this.storage.setString(cacheKey, response.resultBase64);
          return { type: "localUri", uri: cacheKey };
        } catch {
          return { type: "error", error: new VtoError("VTO_FILESYSTEM", "Failed to cache base64 result") };
        }
      }

      if (response.resultUrl) {
        return { type: "remoteUrl", url: response.resultUrl };
      }

      return { type: "error", error: new VtoError("VTO_SERVER", "Missing resultUrl in response") };

    } catch (err: any) {
      if (err.name === "AbortError" || String(err).includes("AbortError")) {
        return { type: "error", error: new VtoError("VTO_TIMEOUT", "VTO request timed out or aborted") };
      }
      if (err.status && err.status >= 500) {
        return { type: "error", error: new VtoError("VTO_SERVER", `Server error: ${err.status}`) };
      }
      return { type: "error", error: new VtoError("VTO_NETWORK", `Network error: ${err.message}`) };
    } finally {
      clearTimeout(timeoutId);
      if (options.signal) options.signal.removeEventListener("abort", abortHandler);
    }
  }

  async startVTO(input: VtoInput, options: VtoOptions = {}): Promise<VtoResult> {
    const retries = options.retries ?? this.defaultRetries;
    let attempt = 0;
    let lastResult: VtoResult | null = null;

    while (attempt <= retries) {
      if (options.signal?.aborted) {
        return { type: "error", error: new VtoError("VTO_TIMEOUT", "Aborted before attempt") };
      }

      lastResult = await this.attemptVTO(input, options);
      if (lastResult.type !== "error") {
        return lastResult;
      }
      attempt++;
    }

    return lastResult!;
  }

  async getCachedResult(key: string): Promise<string | null> {
    return this.storage.getString(key);
  }

  async clearCache(key: string): Promise<void> {
    await this.storage.removeItem(key);
  }
}
