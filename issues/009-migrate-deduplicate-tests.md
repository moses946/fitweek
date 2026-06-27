## Parent PRD

`issues/prd.md` — All candidates (test consolidation)

## What to build

Migrate existing test suites into the new deep-module test structure and eliminate redundant mocks. Currently 8 test files in `__tests__/` mock AsyncStorage, Supabase, and platform APIs independently. After the deep-module extraction, most of these mocks should be replaced by the in-memory fakes provided by each module's adapter layer.

End-to-end: audit all existing tests → move pure-function tests into their respective module test suites (e.g., `outfitSlots.test.ts` → Outfit Slot Store tests) → replace AsyncStorage mocks with `InMemoryStorageAdapter` → replace Supabase mocks with `FakeAuthAdapter` → replace notification mocks with `InMemorySchedulerAdapter` → replace fetch mocks with `InMemoryNetworkAdapter` → delete orphaned test files → verify full test suite passes with `npm test` → confirm test count is equal or greater.

## Acceptance criteria

- [ ] All pure-function tests from `outfitSlots.test.ts`, `garmentStatus.test.ts`, `suggestionFilter.test.ts`, `weatherFilter.test.ts` colocated with their respective deep modules
- [ ] `AuthContext.test.tsx` replaced by: AuthStore unit tests (using FakeAuthAdapter) + thin context-shim integration test
- [ ] `vto.test.ts` replaced by VTO Orchestrator unit tests using InMemoryNetworkAdapter
- [ ] No test file directly imports or mocks `AsyncStorage`, `@supabase/supabase-js`, `expo-notifications`, or global `fetch`
- [ ] All tests use the in-memory fakes provided by each adapter layer
- [ ] `npm test` passes with 0 failures
- [ ] Test count is equal to or greater than the pre-migration count
- [ ] Orphaned test files removed from `__tests__/`

## Blocked by

- Blocked by `issues/008-wire-contexts-to-deep-modules.md`

## User stories addressed

All testing-related user stories from Candidates 1–7:
- Candidate 1, stories 6–7 (unit-tested slot mutations, tiny integration tests)
- Candidate 2, stories 5, 7 (fake classifier, end-to-end deck tests)
- Candidate 3, stories 5, 9 (single orchestrator tests, deterministic proxy simulation)
- Candidate 4, stories 3 (fake token provider and network adapter)
- Candidate 5, stories 2, 5 (in-memory fake, migration validation)
- Candidate 6, stories 4, 6 (fake scheduler, timezone edge cases)
- Candidate 7, stories 3, 5 (fake AuthStore, simulated failures)
