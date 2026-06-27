## Parent PRD

`issues/prd.md` — Candidate 3 (VTO Orchestrator)

## What to build

Extract a VTO Orchestrator deep module that provides a simple public API for initiating a virtual try-on, cancelling it, and retrieving cached results. Currently `lib/vto.ts` (192 lines) mixes network orchestration, timeout/cancellation logic, base64-vs-URL result normalisation, filesystem caching, and slot updates in a single file with direct `fetch` and `expo-file-system` calls. This slice isolates the orchestration behind injected adapters.

End-to-end: create `VTOOrchestrator` with injected `NetworkAdapter` (for fetch) and `StorageAdapter` (for cache writes) → normalise result types into `LocalUri | RemoteUrl | Error` → implement configurable timeout and retry policy → expose `startVTO(input, options)` with cancellation token, `getCachedResult(key)`, `clearCache(key)` → move `selectHeroGarment` into the module as a utility → write unit tests with fake network and storage adapters.

## Acceptance criteria

- [ ] `VTOOrchestrator` module owns: request orchestration, cancellation, retries/timeouts, result normalisation, and cache writes
- [ ] Injected `NetworkAdapter` and `StorageAdapter` (cache) dependencies — no direct `fetch` or `FileSystem` calls
- [ ] `startVTO(input, options)` returns a handle/promise with cancellation token
- [ ] Result types normalised: `{ type: 'localUri', uri }`, `{ type: 'remoteUrl', url }`, `{ type: 'error', error }`
- [ ] `getCachedResult(key)` returns cached image when available, `null` otherwise
- [ ] Timeout and retry policy configurable via `configureDefaults({ timeout, retries })`
- [ ] Error categories: `VTO_NETWORK`, `VTO_SERVER`, `VTO_TIMEOUT`, `VTO_FILESYSTEM` — replacing the current coarse `VTO_TIMEOUT` / `VTO_ERROR`
- [ ] `selectHeroGarment` preserved as a pure utility export
- [ ] Unit tests cover: base64 result handling, URL result handling, cancellation, timeout, retry, cache write success, cache write failure fallback, hero garment selection
- [ ] Existing `vto.test.ts` tests pass or are migrated into orchestrator test suite

## Blocked by

- Blocked by `issues/001-harden-storage-adapter.md` (cache writes use Storage Adapter)
- Blocked by `issues/003-extract-api-client-boundary.md` (network calls use API Client Boundary)

## User stories addressed

- User story 1 (request try-on and see progress)
- User story 2 (cancel in-progress try-on)
- User story 3 (cached images load quickly)
- User story 4 (graceful proxy failure handling)
- User story 5 (single orchestrator for unit testing)
- User story 6 (normalised result types)
- User story 7 (injected network and storage adapters)
- User story 8 (transparent retry and timeout policy)
- User story 9 (deterministic proxy response simulation in tests)
- User story 10 (clear error categories)
