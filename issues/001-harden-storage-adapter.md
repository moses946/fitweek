## Parent PRD

`issues/prd.md` — Candidate 5 (Persistence Abstraction)

## What to build

Harden the existing Storage Adapter (`lib/storage.ts`) into a complete persistence boundary with TTL support, versioned migration helpers, and batch-write semantics. The adapter interface, in-memory fake, and namespace support already exist — this slice adds the missing capabilities called out in the PRD and ensures the adapter is the single entry point for all client-side persistence.

End-to-end: define the TTL and migration APIs → implement in both the AsyncStorage-backed adapter and the in-memory fake → add unit tests covering expiry, migration, and batch-write edge cases → verify existing consumers (`OutfitSlotContext`, `GarmentContext`, `AuthContext`) continue to work unchanged via the existing convenience wrappers.

## Acceptance criteria

- [ ] `StorageAdapter` interface extended with optional `ttl?: number` parameter on `set` and `setString`
- [ ] TTL-expired keys return `null` from `get`/`getString` (both default and in-memory adapters)
- [ ] A `migrate(version, migrations)` helper runs versioned transform functions against stored keys, persists the new version number, and skips already-applied migrations
- [ ] `multiSet` provides atomic batch-write semantics (all-or-nothing via AsyncStorage.multiSet)
- [ ] In-memory fake adapter has parity with production adapter for all new features
- [ ] Unit tests cover: TTL expiry, TTL not-yet-expired, migration apply, migration skip, batch write success, batch write partial failure
- [ ] Existing tests (`outfitSlots.test.ts`, `AuthContext.test.tsx`, etc.) pass without changes

## Blocked by

None — can start immediately.

## User stories addressed

- User story 1 (single storage API)
- User story 2 (in-memory fake for tests)
- User story 3 (migration helper)
- User story 4 (clear serialization rules)
- User story 5 (migration safety)
- User story 6 (batch writes)
- User story 7 (namespace support — already exists, verify it works with new features)
