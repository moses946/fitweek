# PRD: Deep-Module Refactor Candidates

This document contains Product Requirements Documents (PRDs) for seven deep-module refactor candidates discovered during an architectural exploration of the codebase. Each candidate uses the same template: Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, and Further Notes.

---

## Candidate 1 — Outfit Slot Domain + Persistence

## Problem Statement

The outfit-slot domain logic (mutations and validation), persistence, and scheduled-notification lifecycle are scattered across small pure helpers and React context providers. This scattering forces readers and maintainers to jump between domain functions, context persistence code, and notification scheduling logic to understand a single behavior. Tests for contexts are integration-heavy and brittle because they mock platform APIs (storage, notifications) repeatedly.

## Solution

Extract a deep module — an Outfit Slot Store — that encapsulates slot data model transformations, persistence semantics, scheduling integration, and VTO result updates behind a concise boundary. The module exposes a small set of operations for the UI to call; it depends on a storage abstraction and a scheduler abstraction which are injected. Most business rules remain unit tested inside the module; a few boundary integration tests validate persistence and scheduling behaviour.

## User Stories

1. As a mobile user, I want to create a draft outfit slot, so that I can plan outfits and keep them between app restarts.
2. As a mobile user, I want scheduled outfit reminders to fire at the correct time, so that I don’t forget planned outfits.
3. As a mobile user, I want VTO results attached to a slot to persist, so I can see try-on images offline.
4. As a mobile user, I want confirming a slot to clear draft state and cancel draft notifications, so I have a consistent lifecycle.
5. As a developer, I want a single, small API for outfit slot operations, so I can reason about slot behaviour without navigating many files.
6. As a developer, I want slot mutation rules unit-tested in isolation, so I catch logic bugs without heavy platform mocks.
7. As a QA engineer, I want a tiny set of integration tests that assert persistence and scheduled-notification side effects, so tests are reliable and fast.
8. As a product manager, I want existing user data to migrate seamlessly, so users aren’t confused after rollout.
9. As a developer, I want an injected scheduler interface, so I can run tests without platform-specific dependencies.
10. As a developer, I want the module to provide atomic write semantics for slot updates, so the app avoids partial state on crash.
11. As a developer, I want the module to expose bulk-write operations for importing/migrating slots, so migrations and sync are easier to implement.
12. As a developer, I want clear error classification (storage error, validation error, scheduling error) surfaced at the boundary, so UI code can handle failures sensibly.

## Implementation Decisions

- Create a single Outfit Slot Store module that owns: slot mutations, serialization, persistence calls, notification scheduling coordination, and VTO result updates.
- The Store takes two dependencies by injection: a Storage Adapter and a Scheduler Adapter. Both are small, well-specified interfaces.
- The Store will provide a concise public surface (query slots, createDraft, updateSlot, confirmSlot, deleteSlot, bulkImport, getSlotVto) and will be the only location that performs JSON serialization for slot data.
- ID generation and migration helpers will be provided inside the module to centralize semantics.
- Backwards compatibility strategy: provide a thin shim for the existing context hook(s) that delegates to the Store; adopt incrementally so UI work is minimal per-PR.
- Persistence semantics: provide optional transactional/batch writes and optimistic-update pattern for UI convenience. Define explicit failure modes for callers.

## Testing Decisions

- Good tests focus on external behaviour: given initial storage state and a sequence of operations, assert final storage state and scheduled notifications.
- Unit tests: Outfit Slot Store with an in-memory fake Storage Adapter and fake Scheduler Adapter to exercise all mutation and scheduling paths.
- Integration tests: one or two boundary tests that use the real Storage Adapter against a test AsyncStorage and a spy scheduler to validate glue behaviour.
- Prior art: existing pure-function tests (slot mutation tests) should be moved/kept inside the Store test suite; context tests that heavily mock storage/scheduler can be replaced by small context shim tests asserting hook -> Store delegation.

## Out of Scope

- UI component redesign beyond wiring to the new Store API.
- Server-side or cloud storage changes.

## Further Notes

- Migration plan: 1) extract Storage Adapter, 2) implement in-memory fake and run Store unit tests, 3) add shim to delegate one context to the Store, 4) incrementally switch other contexts.
- Risk: must ensure the Store’s persistence format is compatible or provides a migration path for existing persisted data.

---

## Candidate 2 — Garment Domain + Suggestion Pipeline

## Problem Statement

Garment classification, status (worn/skip), and the suggestion pipeline (filter, rank) are split across small pure helpers and the garment context. This separation makes it hard to reason about how garments are scored and why a particular garment appears in suggestions. Some classifiers and network calls live inside contexts, causing heavy mocks in tests and leaking runtime dependencies into domain logic.

## Solution

Introduce a Suggestion Engine deep module that encapsulates garment scoring, skip/worn semantics, and the filtering pipeline. The engine takes a pluggable Classifier Adapter and a Garment Repository (read/write) dependency. The engine exports a minimal API to build suggestion decks and to apply user actions (skip, mark worn, undo). The classifier remains injectable to keep the module testable.

## User Stories

1. As a mobile user, I want the app to suggest outfits that respect my recent wears and skips, so recommendations feel relevant.
2. As a mobile user, I want to be able to skip a garment for the week or session, so I don't see irrelevant suggestions.
3. As a mobile user, I want suggestions to update quickly after I add or remove garments, so the app stays responsive.
4. As a developer, I want a single module that encapsulates scoring and filtering, so I can change the ranking algorithm without touching UI code.
5. As a developer, I want to inject a fake classifier in tests, so I can deterministically test ranking and filtering.
6. As a product owner, I want to A/B different ranking features, so the engine should support feature-flag-driven weights.
7. As a QA engineer, I want end-to-end tests that validate sample garment sets produce expected suggestion decks.
8. As a developer, I want clear metrics and logging hooks inside the engine so performance or correctness issues can be diagnosed.
9. As a developer, I want the engine to expose a compact representation of a suggestion deck so UI code can render with minimal transformation.
10. As a tester, I want predictable behavior at boundary conditions (empty wardrobe, recently added garments), so user-visible regressions are easier to detect.

## Implementation Decisions

- Build a Suggestion Engine module that owns scoring, filtering, and deck construction.
- The engine depends on two injected adapters: a Classifier Adapter (abstracts network or local image classification) and a Garment Repository (abstracts persistence). Both adapters have tiny, well-documented interfaces.
- The engine will accept configuration for ranking weights and feature flags through a simple config object to enable experimentation.
- Provide operations: buildDeck(context), applyAction(garmentId, action) where actions include skip, markWorn, undo, and revokeSkip.
- Keep side effects off the core logic: the engine returns the changes to apply; callers are responsible for persisting them via the repository. Optionally provide a convenience wrapper that applies changes transactionally using the repository.

## Testing Decisions

- Good tests validate observable behavior: given an input set and classifier outputs, assert the deck and winners.
- Unit tests: Suggestion Engine with a deterministic fake classifier and in-memory repository. Cover ranking, skip semantics, and edge cases.
- Integration tests: validate engine + real repository shim (in-memory) to ensure persistence interactions succeed.
- Prior art: existing unit tests for garmentStatus and suggestionFilter provide examples and should be folded into the engine test suite.

## Out of Scope

- Training or changing the external classifier model and server-side components.
- UI transitions for rendering suggestion decks.

## Further Notes

- The classifier should be injected so that future improvements (local ML vs server classifier) are a simple configuration change.
- This refactor enables A/B testing and safer experiments in ranking behavior.

---

## Candidate 3 — VTO Orchestrator (try-on orchestration + caching + slot update)

## Problem Statement

Virtual try-on (VTO) orchestration is implemented inside a file with network, timeout, and filesystem logic. The orchestration touches cancellation, fetch timeouts, base64 vs URL result handling, caching to disk, and slot updates. The orchestration is not isolated from consumers, and tests must mock fetch and filesystem in multiple places. External proxy/server behaviour is out-of-repo which complicates local reasoning.

## Solution

Extract a VTO Orchestrator deep module that provides a simple public API for initiating a try-on, cancelling it, and retrieving cached results. The orchestrator will normalize result shapes (base64/localUri/remoteUrl), manage timeouts and retry behavior, and write cached images via an injected Storage Adapter. Consumers receive well-defined result types and errors.

## User Stories

1. As a mobile user, I want to request a try-on and see progress, so I know the app is working.
2. As a mobile user, I want to cancel a try-on while it's in progress, so I save bandwidth and avoid waiting.
3. As a mobile user, I want try-on images to load from cache when available, so they appear quickly.
4. As a mobile user, I want the app to handle remote proxy failures gracefully, so the UI can show a retry option.
5. As a developer, I want a single orchestrator to unit-test abort/timeouts and caching without mocking global fetch everywhere.
6. As a developer, I want normalized result types so callers don’t need to implement branching logic for base64 vs URL.
7. As a developer, I want to inject the network adapter and storage adapter so the orchestrator is testable and runtime-agnostic.
8. As a product manager, I want transparent retry and timeout policy so UX decisions can be changed without touching callers.
9. As a QA engineer, I want deterministic tests that simulate proxy responses (base64 vs url vs failure) and assert caching behavior.
10. As a developer, I want the orchestrator to provide clear error categories (network, server, timeout, filesystem) so UI can show helpful messages.

## Implementation Decisions

- Build a VTO Orchestrator module that owns request orchestration, cancellation semantics, retries/timeouts, result normalization, and cache writes.
- The module depends on an injected Network Adapter (for fetch) and Storage Adapter (for writing cache). It also depends on a small time/clock helper for deterministic testing of timeouts.
- Public operations: startVTO(input, options) -> returns a handle or promise with cancellation token; getCachedResult(key); clearCache(key); configureDefaults({ timeout, retries }).
- Normalize outputs into a small set of result types (LocalUri, RemoteUrl, Error) and surface them consistently.

## Testing Decisions

- Unit tests: orchestrator with fake network adapter and fake storage adapter to exercise base64 handling, URL handling, cancellation, retry, and timeouts.
- Integration tests: orchestrator + in-memory file-cache to validate file-write flows and correct cache lookup behaviour.
- Prior art: existing vto unit tests that mock fetch should be migrated to test orchestrator behaviour and eliminat redundant mocks elsewhere.

## Out of Scope

- Server-side VTO model changes and proxy implementation.

## Further Notes

- Because the proxy is external, the orchestrator must be configurable for endpoint and behavior; reliable mocking will be an important part of tests.

---

## Candidate 4 — API Client Boundary (generated clients + custom-fetch)

## Problem Statement

The codebase contains a custom fetch wrapper with many runtime heuristics (token provider integration, RN/browser differences, response parsing). There are few if any focused tests for these runtime behaviors, and generated API bindings depend on this utility implicitly. The wiring to set base URL and token getter is distributed and not obvious to a reader.

## Solution

Create a small, well-documented API Client Boundary module that centralizes token management, baseUrl wiring, runtime differences, and response normalization. The module exposes an ApiClientFactory and a token-provider interface. Generated clients use the factory to get a configured fetch function; tests can swap the token provider or runtime adapter easily.

## User Stories

1. As a developer, I want to configure API base URL and token provider in a single place, so network wiring is obvious.
2. As a developer, I want deterministic parsing rules for responses and errors, so callers can handle API errors uniformly.
3. As a test engineer, I want to swap in a fake token provider and fake network adapter for tests, so generated clients are easy to test.
4. As a developer, I want clear runtime adapters for RN vs browser, so edge cases are isolated.
5. As a product manager, I want the ability to point the client at a staging base URL for testing without changing many call sites.
6. As a developer, I want the module to normalize authentication failures into a small set of error types, so Auth flows can be simpler.
7. As an engineer, I want to reduce duplicated logic around content negotiation and response parsing across the app.

## Implementation Decisions

- Build an ApiClientBoundary module exposing an ApiClientFactory and a Token Provider interface.
- Implement runtime adapters (default browser/RN adapters) inside the module; expose a small configuration API for baseUrl, timeout, and token getter.
- Normalize response parsing into a consistent set of success and error shapes; provide a small set of typed error classes.
- Keep generated client code unchanged where possible; have it call the exposed factory to get a configured request function.

## Testing Decisions

- Unit tests: response normalization, token provider behavior, and runtime adapter behaviors under simulated environments.
- Integration tests: generated client + fake network adapter to assert end-to-end request/response shape and error handling.
- Prior art: no dedicated tests currently; create focused unit tests to reduce duplicated network mocks in context tests.

## Out of Scope

- Re-generating the OpenAPI client schema; this module should be compatible with generated code.

## Further Notes

- This change reduces brittle tests and makes it easier to add telemetry or retry logic in one place.

---

## Candidate 5 — Persistence Abstraction (AsyncStorage wrapper)

## Problem Statement

Multiple contexts duplicate AsyncStorage usage patterns: keys, serialization, error handling, and test mocks. Tests mock AsyncStorage in many places, making the test-suite more brittle and adding cognitive load when reasoning about persisted semantics.

## Solution

Introduce a small Storage Adapter that provides a minimal, typed API (get, set, remove, multiGet/multiSet, namespace support, optional TTL, and an in-memory fake for tests). Consume the adapter from contexts and from new deep modules instead of calling AsyncStorage directly.

## User Stories

1. As a developer, I want a single storage API to interact with persisted app state, so contexts don’t duplicate logic.
2. As a tester, I want an in-memory storage fake I can use in unit tests, so I avoid heavy AsyncStorage mocking.
3. As a developer, I want a migration helper to transform persisted shapes, so schema changes are manageable.
4. As a developer, I want clear serialization rules so tests and production code behave identically.
5. As a QA engineer, I want to validate that migration scripts run safely and preserve user data.
6. As a developer, I want the storage adapter to support batch writes to reduce race conditions.
7. As a developer, I want namespace support so different features don’t collide on keys.

## Implementation Decisions

- Implement a Storage Adapter interface with operations: get(key), set(key, value), remove(key), multiGet(keys), multiSet(entries), with optional namespace and TTL support.
- Default implementation uses AsyncStorage; provide an in-memory fake for tests.
- Add a small migration library that runs versioned migration functions against stored keys.
- Encourage consumers to use the adapter rather than direct AsyncStorage calls; provide shims to make adoption incremental.

## Testing Decisions

- Unit tests: Storage Adapter default behavior (with a tiny test harness) and the in-memory fake behavior parity.
- Integration tests: migration functions applied to a local test store, asserting expected transforms.
- Prior art: existing context tests that currently mock AsyncStorage can be simplified to use the in-memory fake adapter.

## Out of Scope

- Replacing server-side persistence; this is a client-side storage abstraction only.

## Further Notes

- This is a low-risk, high-impact first step. It simplifies many context tests and unlocks safer deep-module extraction for domain modules.

---

## Candidate 6 — Notification & Scheduling Platform Boundary

## Problem Statement

Scheduling logic is split between pure time helpers and a thin dynamic-import wrapper around the platform's notifications API. Tests must mock dynamic imports and platform APIs, which increases test complexity. The semantics of scheduling and cancellation are not centralized.

## Solution

Extract a Scheduler deep module that contains pure time helpers (computeNextSundayAt7pm) and a scheduling adapter with a consistent interface (schedule, cancel, list). The default adapter wraps the platform notification API; tests use a fake adapter. The module guarantees idempotent scheduling semantics and clear error reporting.

## User Stories

1. As a mobile user, I want scheduled reminders to be set reliably, so I get reminders for planned outfits.
2. As a mobile user, I want scheduled notifications to be cancellable when a plan changes, so I get relevant alerts only.
3. As a developer, I want deterministic time helpers so I can test date calculations without injecting complex mocks.
4. As a developer, I want to inject a fake scheduler in tests, so I avoid mocking platform notification libraries.
5. As a developer, I want idempotent scheduling (scheduling the same reminder twice does not cause duplicates), so notifications are predictable.
6. As a QA engineer, I want to assert scheduled time correctness for edge dates (DST boundaries, timezone changes), so notifications trigger at expected local times.

## Implementation Decisions

- Provide Scheduler module with two parts: pure time utilities and a scheduling adapter interface.
- Adapter interface includes schedule(notificationSpec) -> id, cancel(id), cancelAll(namespace), list(namespace).
- Default adapter implements platform notification libraries and mirrors existing swallowed-dynamic-import behavior but with clearer error handling.
- Time helpers are exported and well-tested separately.

## Testing Decisions

- Unit tests: pure time helpers and scheduler adapter behaviors using the fake adapter.
- Integration tests: contexts wired to the fake scheduler to assert scheduling/cancellation calls.
- Prior art: computeNextSundayAt7pm tests should be preserved and colocated with the scheduler’s pure utilities.

## Out of Scope

- Cross-device push-notification server setup.

## Further Notes

- The scheduler abstraction makes notifications testable and avoids brittle dynamic-import mocks. Timezone and DST handling needs careful test coverage.

---

## Candidate 7 — Auth + Supabase Boundary

## Problem Statement

AuthContext is tightly coupled to the Supabase client; tests mock Supabase at a low level which makes them fragile. Auth flows (session resolution, sign-in, sign-out, user profile fetch) are mixed with UI-state logic.

## Solution

Introduce an AuthStore (small deep module) that exposes a compact session-management API (getSession, signIn, signOut, onAuthChange, getProfile). An adapter layer maps the AuthStore to the Supabase client. AuthContext becomes a thin hook that consumes AuthStore. Tests for UI and contexts mock AuthStore instead of Supabase directly.

## User Stories

1. As a mobile user, I want a reliable sign-in/sign-out experience that survives app restarts.
2. As a mobile user, I want session state to be accurate and reflected in the UI quickly.
3. As a developer, I want to test auth flows with a fake AuthStore, so tests do not need to mock Supabase internals.
4. As a developer, I want to isolate token/session persistence and renewal into a small module, so auth edge cases are easier to reason about.
5. As a QA engineer, I want to simulate sign-in failures and expired sessions deterministically for testing UI behaviour.
6. As a developer, I want the AuthStore to emit clear events for auth changes so contexts can react reliably.

## Implementation Decisions

- Build an AuthStore module that defines the public auth API for the app and emits change events.
- Provide a Supabase adapter that implements AuthStore using the Supabase client; keep the adapter thin and well-tested.
- AuthContext becomes a small consumer of AuthStore that maps store state to React state and provides hooks to components.
- Authentication persistence may leverage the Storage Adapter created earlier; plan for token/migration handling.

## Testing Decisions

- Unit tests: AuthStore behavior and event-emission using a fake supabase adapter.
- Integration tests: AuthContext that consumes a fake AuthStore to ensure hook behavior is correct without mocking Supabase.
- Prior art: existing AuthContext tests that mock Supabase should be replaced with tests that mock the AuthStore interface.

## Out of Scope

- Changing Supabase server-side auth behavior or server configuration.

## Further Notes

- This refactor reduces brittle tests and concentrates auth-related edge cases. Careful attention is required for session migration and refresh semantics.

---

# Next Steps / Requests for You

1. Confirm you want PRDs for all seven candidates written to issues/prd.md (done). If you prefer separate PRD files per candidate I can split them into individual files under issues/.
2. Which of the modules above would you like tests written for first? (Examples: Outfit Slot Store, Suggestion Engine, VTO Orchestrator, ApiClientBoundary, Storage Adapter, Scheduler, AuthStore.)
3. Which candidate(s) should we prioritize for implementation? I recommend starting with the Storage Adapter (persistence abstraction) and then Outfit Slot Store.
4. Any constraints I should apply to designs (deadline, maximum-sized PRs, compatibility requirements, or runtime environments to support)?

I created this PRD at issues/prd.md. Tell me which module(s) to prioritize for tests and/or implementation and any constraints you want applied; I'll follow up with a migration plan and incremental PR-sized steps.
