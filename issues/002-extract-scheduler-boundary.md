## Parent PRD

`issues/prd.md` — Candidate 6 (Notification & Scheduling Platform Boundary)

## What to build

Extract a Scheduler deep module that centralises pure time helpers and notification scheduling behind a consistent adapter interface. Currently `outfitSlotNotifications.ts` contains `computeNextSundayAt7pm` (pure) alongside `scheduleSundayPlannerNotification` (platform-coupled via dynamic `import("expo-notifications")`). This slice separates them into a clean boundary.

End-to-end: define a `SchedulerAdapter` interface (`schedule`, `cancel`, `cancelAll`, `list`) → implement a default adapter wrapping `expo-notifications` → implement a fake adapter for tests → move `computeNextSundayAt7pm` and related time utilities into the module → write unit tests for all time helpers and adapter behaviors → verify `OutfitSlotContext` can use the new scheduler without behavior changes.

## Acceptance criteria

- [ ] `SchedulerAdapter` interface defined with `schedule(spec) → id`, `cancel(id)`, `cancelAll(namespace)`, `list(namespace)`
- [ ] Default adapter wraps `expo-notifications` with clear error handling (replaces current swallowed dynamic import)
- [ ] Fake `InMemorySchedulerAdapter` records all calls and exposes them for assertions
- [ ] `computeNextSundayAt7pm` and any future time helpers are exported from the module's pure-utility surface
- [ ] Scheduling is idempotent — scheduling the same reminder twice does not create duplicates
- [ ] Unit tests cover: time helpers (including DST/timezone edge cases), schedule/cancel/list via fake adapter, idempotent scheduling
- [ ] Existing `outfitSlotNotifications` tests pass or are migrated into the new module's test suite

## Blocked by

None — can start immediately.

## User stories addressed

- User story 1 (reliable scheduled reminders)
- User story 2 (cancellable notifications)
- User story 3 (deterministic time helpers)
- User story 4 (fake scheduler in tests)
- User story 5 (idempotent scheduling)
- User story 6 (DST/timezone edge dates)
