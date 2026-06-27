/**
 * Storage Adapter
 *
 * Purpose:
 * - Provide a single, test-friendly storage abstraction over AsyncStorage.
 * - Export typed get<T>/set<T> helpers which JSON serialize/deserialize values.
 * - Export raw getString/setString for callers that expect exact string semantics.
 * - Allow tests to swap in an in-memory adapter via setAdapter().
 * - Support optional TTL and database migration.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export type StorageMap = Record<string, string | null>;

export type StorageAdapter = {
  getString: (key: string) => Promise<string | null>;
  setString: (key: string, value: string, ttl?: number) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  multiGet: (keys: string[]) => Promise<StorageMap>;
  multiSet: (entries: Record<string, string>) => Promise<void>;

  /**
   * Typed getter. If the stored value is valid JSON it will be parsed and returned.
   * If JSON.parse fails the raw string value will be returned (use getString if
   * you expect raw string semantics and want to avoid this fallback).
   */
  get: <T = unknown>(key: string) => Promise<T | null>;
  /**
   * Typed setter. Value will be JSON.stringified before being stored. Use
   * setString for raw string values that should not be JSON-wrapped.
   */
  set: <T = unknown>(key: string, value: T, ttl?: number) => Promise<void>;
};

// --------------------- Helper: Expiry Key ----------------------------------

function getExpiryKey(key: string): string {
  return `${key}_expiry`;
}

// --------------------- Default AsyncStorage-backed adapter ------------------

const asyncStorageAdapter: StorageAdapter = {
  async getString(key: string) {
    try {
      const expKey = getExpiryKey(key);
      const [valTuple, expTuple] = await AsyncStorage.multiGet([key, expKey]);
      const val = valTuple[1];
      const expStr = expTuple[1];

      if (expStr) {
        const expiry = parseInt(expStr, 10);
        if (Date.now() > expiry) {
          // Expired
          await AsyncStorage.multiRemove([key, expKey]);
          return null;
        }
      }

      return val;
    } catch (err) {
      // Non-fatal: return null on error
      console.warn(`[storage] getString failed for key=${key}`, err);
      return null;
    }
  },

  async setString(key: string, value: string, ttl?: number) {
    try {
      if (ttl && ttl > 0) {
        const expiry = Date.now() + ttl;
        await AsyncStorage.multiSet([
          [key, value],
          [getExpiryKey(key), expiry.toString()],
        ]);
      } else {
        await AsyncStorage.multiSet([
          [key, value],
          [getExpiryKey(key), ""], // clear any old expiry
        ]);
      }
    } catch (err) {
      // Non-fatal
      console.warn(`[storage] setString failed for key=${key}`, err);
    }
  },

  async removeItem(key: string) {
    try {
      await AsyncStorage.multiRemove([key, getExpiryKey(key)]);
    } catch (err) {
      // Non-fatal
      console.warn(`[storage] removeItem failed for key=${key}`, err);
    }
  },

  async multiGet(keys: string[]) {
    try {
      const expKeys = keys.map(getExpiryKey);
      const allKeys = [...keys, ...expKeys];
      const pairs = await AsyncStorage.multiGet(allKeys);
      
      const valMap = new Map<string, string | null>();
      for (const [k, v] of pairs) valMap.set(k, v);

      const out: StorageMap = {};
      const toRemove: string[] = [];

      for (const key of keys) {
        const val = valMap.get(key) ?? null;
        const expStr = valMap.get(getExpiryKey(key));

        if (expStr && val !== null) {
          const expiry = parseInt(expStr, 10);
          if (Date.now() > expiry) {
            out[key] = null;
            toRemove.push(key, getExpiryKey(key));
            continue;
          }
        }
        out[key] = val;
      }

      if (toRemove.length > 0) {
        await AsyncStorage.multiRemove(toRemove);
      }

      return out;
    } catch (err) {
      // Non-fatal: return map of nulls
      console.warn(`[storage] multiGet failed for keys=${keys.join(",")}`, err);
      const out: StorageMap = {};
      for (const k of keys) out[k] = null;
      return out;
    }
  },

  async multiSet(entries: Record<string, string>) {
    try {
      const pairs: [string, string][] = [];
      for (const [k, v] of Object.entries(entries)) {
        pairs.push([k, v]);
        // Clean up old expiry if setting in bulk
        pairs.push([getExpiryKey(k), ""]);
      }
      await AsyncStorage.multiSet(pairs);
    } catch (err) {
      // Non-fatal
      console.warn(`[storage] multiSet failed`, err);
    }
  },

  async get<T = unknown>(key: string) {
    try {
      // Use our own getString to handle expiry checking
      const raw = await asyncStorageAdapter.getString(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch (parseErr) {
        console.debug(`[storage] JSON.parse failed for key=${key}, returning raw string`);
        return raw as unknown as T;
      }
    } catch (err) {
      console.warn(`[storage] get failed for key=${key}`, err);
      return null;
    }
  },

  async set<T = unknown>(key: string, value: T, ttl?: number) {
    try {
      await asyncStorageAdapter.setString(key, JSON.stringify(value), ttl);
    } catch (err) {
      console.warn(`[storage] set failed for key=${key}`, err);
    }
  },
};

// --------------------- In-memory adapter for tests -------------------------

export interface InMemoryStorageAdapter extends StorageAdapter {
  clear(): void;
}

export function createInMemoryStorageAdapter(initial: Record<string, string> = {}): InMemoryStorageAdapter {
  const store = new Map<string, string>(Object.entries(initial));

  return {
    clear(): void {
      store.clear();
    },

    async getString(key: string) {
      const val = store.get(key) ?? null;
      const expStr = store.get(getExpiryKey(key));

      if (val !== null && expStr) {
        const expiry = parseInt(expStr, 10);
        if (Date.now() > expiry) {
          store.delete(key);
          store.delete(getExpiryKey(key));
          return null;
        }
      }
      return val;
    },

    async setString(key: string, value: string, ttl?: number) {
      store.set(key, value);
      if (ttl && ttl > 0) {
        store.set(getExpiryKey(key), (Date.now() + ttl).toString());
      } else {
        store.delete(getExpiryKey(key));
      }
    },

    async removeItem(key: string) {
      store.delete(key);
      store.delete(getExpiryKey(key));
    },

    async multiGet(keys: string[]) {
      const out: StorageMap = {};
      for (const k of keys) {
        const val = store.get(k) ?? null;
        const expStr = store.get(getExpiryKey(k));
        
        if (val !== null && expStr) {
          const expiry = parseInt(expStr, 10);
          if (Date.now() > expiry) {
            store.delete(k);
            store.delete(getExpiryKey(k));
            out[k] = null;
            continue;
          }
        }
        out[k] = val;
      }
      return out;
    },

    async multiSet(entries: Record<string, string>) {
      for (const [k, v] of Object.entries(entries)) {
        store.set(k, v);
        store.delete(getExpiryKey(k));
      }
    },

    async get<T = unknown>(key: string) {
      const raw = await this.getString(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    },

    async set<T = unknown>(key: string, value: T, ttl?: number) {
      await this.setString(key, JSON.stringify(value), ttl);
    },
  };
}

// --------------------- Helper: namespaced adapter --------------------------

export function createNamespacedAdapter(adapter: StorageAdapter, namespace: string): StorageAdapter {
  const prefix = namespace.endsWith("/") ? namespace : namespace + "/";
  return {
    async getString(key: string) {
      return adapter.getString(prefix + key);
    },
    async setString(key: string, value: string, ttl?: number) {
      return adapter.setString(prefix + key, value, ttl);
    },
    async removeItem(key: string) {
      return adapter.removeItem(prefix + key);
    },
    async multiGet(keys: string[]) {
      const prefixed = keys.map((k) => prefix + k);
      const map = await adapter.multiGet(prefixed);
      const out: StorageMap = {};
      for (const k of keys) out[k] = map[prefix + k] ?? null;
      return out;
    },
    async multiSet(entries: Record<string, string>) {
      const prefixed: Record<string, string> = {};
      for (const [k, v] of Object.entries(entries)) prefixed[prefix + k] = v;
      return adapter.multiSet(prefixed);
    },
    async get<T = unknown>(key: string) {
      return adapter.get<T>(prefix + key);
    },
    async set<T = unknown>(key: string, value: T, ttl?: number) {
      return adapter.set<T>(prefix + key, value, ttl);
    },
  };
}

// --------------------- Module-level singleton ------------------------------

let currentAdapter: StorageAdapter = asyncStorageAdapter;

export function setAdapter(adapter: StorageAdapter) {
  currentAdapter = adapter;
}

export function getAdapter(): StorageAdapter {
  return currentAdapter;
}

// Convenience wrappers that delegate to the current adapter
export const getString = (key: string) => currentAdapter.getString(key);
export const setString = (key: string, value: string, ttl?: number) => currentAdapter.setString(key, value, ttl);
export const removeItem = (key: string) => currentAdapter.removeItem(key);
export const multiGet = (keys: string[]) => currentAdapter.multiGet(keys);
export const multiSet = (entries: Record<string, string>) => currentAdapter.multiSet(entries);
export const get = <T = unknown>(key: string) => currentAdapter.get<T>(key);
export const set = <T = unknown>(key: string, value: T, ttl?: number) => currentAdapter.set<T>(key, value, ttl);

export function resetStorage(): void {
  const adapter = currentAdapter as InMemoryStorageAdapter;
  if (typeof adapter.clear === "function") {
    adapter.clear();
  }
}

// --------------------- Migration helper ------------------------------------

const VERSION_KEY = "@fitweek/storage_version";

export type MigrationFn = (store: StorageAdapter) => Promise<void>;

/**
 * Runs versioned transform functions against stored keys.
 * Skips migrations that have already been applied.
 * Updates the `@fitweek/storage_version` key upon success.
 */
export async function migrate(
  targetVersion: number,
  migrations: Record<number, MigrationFn>
): Promise<void> {
  const adapter = getAdapter();
  const currentVersionStr = await adapter.getString(VERSION_KEY);
  const currentVersion = currentVersionStr ? parseInt(currentVersionStr, 10) : 0;

  if (currentVersion >= targetVersion) {
    return; // Already up to date
  }

  // Run pending migrations sequentially
  for (let v = currentVersion + 1; v <= targetVersion; v++) {
    const migration = migrations[v];
    if (migration) {
      await migration(adapter);
    }
  }

  await adapter.setString(VERSION_KEY, targetVersion.toString());
}

export default {
  setAdapter,
  getAdapter,
  getString,
  setString,
  removeItem,
  multiGet,
  multiSet,
  get,
  set,
  createInMemoryStorageAdapter,
  createNamespacedAdapter,
  resetStorage,
  migrate,
};
