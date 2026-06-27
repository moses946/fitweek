import storage, { createInMemoryStorageAdapter, setAdapter, migrate } from "../lib/storage";

describe("Storage Adapter", () => {
  beforeEach(() => {
    const memoryAdapter = createInMemoryStorageAdapter();
    setAdapter(memoryAdapter);
  });

  afterEach(() => {
    storage.resetStorage();
  });

  it("should set and get values correctly", async () => {
    await storage.set("test-key", { hello: "world" });
    const val = await storage.get<{ hello: string }>("test-key");
    expect(val).toEqual({ hello: "world" });
  });

  it("should handle raw strings correctly", async () => {
    await storage.setString("string-key", "raw-value");
    const val = await storage.getString("string-key");
    expect(val).toBe("raw-value");
  });

  it("should respect TTL expiry", async () => {
    jest.useFakeTimers();
    
    // Set with 5 seconds TTL
    await storage.set("ttl-key", "temporary", 5000);
    
    const immediate = await storage.get("ttl-key");
    expect(immediate).toBe("temporary");

    // Advance by 6 seconds
    jest.advanceTimersByTime(6000);

    const expired = await storage.get("ttl-key");
    expect(expired).toBeNull();
    
    jest.useRealTimers();
  });

  it("should respect TTL for raw strings", async () => {
    jest.useFakeTimers();
    
    await storage.setString("ttl-str", "raw", 1000);
    expect(await storage.getString("ttl-str")).toBe("raw");

    jest.advanceTimersByTime(2000);
    expect(await storage.getString("ttl-str")).toBeNull();
    
    jest.useRealTimers();
  });

  it("should support bulk reads and writes with multiSet/multiGet", async () => {
    await storage.multiSet({
      "key1": "val1",
      "key2": "val2"
    });

    const results = await storage.multiGet(["key1", "key2", "missing"]);
    expect(results).toEqual({
      "key1": "val1",
      "key2": "val2",
      "missing": null,
    });
  });

  it("should run migrations and update version", async () => {
    let migration1Ran = false;
    let migration2Ran = false;

    const migrations = {
      1: async (store: any) => {
        migration1Ran = true;
        await store.setString("migrated-1", "yes");
      },
      2: async (store: any) => {
        migration2Ran = true;
        await store.setString("migrated-2", "yes");
      }
    };

    await migrate(2, migrations);

    expect(migration1Ran).toBe(true);
    expect(migration2Ran).toBe(true);
    expect(await storage.getString("@fitweek/storage_version")).toBe("2");
    expect(await storage.getString("migrated-1")).toBe("yes");
    expect(await storage.getString("migrated-2")).toBe("yes");
  });

  it("should skip already-run migrations", async () => {
    await storage.setString("@fitweek/storage_version", "1");
    
    let migration1Ran = false;
    let migration2Ran = false;

    const migrations = {
      1: async () => { migration1Ran = true; },
      2: async () => { migration2Ran = true; }
    };

    await migrate(2, migrations);

    expect(migration1Ran).toBe(false); // Skipped
    expect(migration2Ran).toBe(true);  // Ran
    expect(await storage.getString("@fitweek/storage_version")).toBe("2");
  });
});
