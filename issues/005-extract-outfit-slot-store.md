## Parent PRD

`issues/prd.md` — Candidate 1 (Outfit Slot Domain + Persistence)

## What to build

Extract an Outfit Slot Store deep module that encapsulates slot mutations, persistence, notification scheduling coordination, and VTO result updates behind a concise boundary. Currently the domain logic lives in `lib/outfitSlots.ts` (pure mutations) and `contexts/OutfitSlotContext.tsx` (persistence + scheduling glue) — this slice merges them into a single coherent module.

End-to-end: create `OutfitSlotStore` with injected `StorageAdapter` (from `issues/001-harden-storage-adapter.md`) and `SchedulerAdapter` (from `issues/002-extract-scheduler-boundary.md`) → move all slot mutations (`addGarmentToSlot`, `removeGarmentFromSlot`, `confirmSlot`, `clearSlot`, `renameSlot`, `cleanupExpiredDrafts`, `markAllWorn`, `getOrCreateDraftSlot`, `getConfirmedGarmentIds`, `bulkWriteDrafts`) into the Store → add `saveVTOResult` from `vto.ts` → expose atomic write semantics and bulk-import → write unit tests with in-memory fakes → provide a migration path for existing `@fitweek/outfit_slots_v1` persisted data.

## Acceptance criteria

- [ ] `OutfitSlotStore` owns all slot operations: `createDraft`, `addGarment`, `removeGarment`, `confirmSlot`, `clearSlot`, `renameSlot`, `markAllWorn`, `saveVtoResult`, `bulkImport`, `getSlotForDate`, `getConfirmedGarmentIds`
- [ ] Store takes `StorageAdapter` and `SchedulerAdapter` by injection
- [ ] Store handles JSON serialization internally — callers never touch raw storage
- [ ] Atomic/batch write semantics: slot updates are persisted as a single `multiSet` call
- [ ] ID generation centralised inside the module
- [ ] Data migration: existing `@fitweek/outfit_slots_v1` format loads correctly
- [ ] Unit tests with in-memory fakes cover: all 9 existing mutation tests + persistence round-trip + scheduling coordination + VTO result attachment + bulk import + cleanup of expired drafts
- [ ] Existing `outfitSlots.test.ts` tests pass (migrated into new suite) or are replaced by equivalent Store-level tests

## Blocked by

- Blocked by `issues/001-harden-storage-adapter.md` (Store depends on Storage Adapter)
- Blocked by `issues/002-extract-scheduler-boundary.md` (Store depends on Scheduler Adapter)

## User stories addressed

- User story 1 (draft persistence across restarts)
- User story 2 (scheduled reminders at correct time)
- User story 3 (VTO results persist offline)
- User story 4 (confirm clears draft state)
- User story 5 (single small API for slot operations)
- User story 6 (unit-tested mutations in isolation)
- User story 7 (tiny set of integration tests)
- User story 8 (seamless data migration)
- User story 9 (injected scheduler interface)
- User story 10 (atomic write semantics)
- User story 11 (bulk-write for import/migration)
- User story 12 (clear error classification)
