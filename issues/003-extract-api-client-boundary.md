## Parent PRD

`issues/prd.md` — Candidate 4 (API Client Boundary)

## What to build

Create a well-documented API Client Boundary module that centralises the existing `custom-fetch.ts` functionality (token management, base URL wiring, RN/browser runtime differences, response normalisation) behind a clean `ApiClientFactory` and `TokenProvider` interface. The current implementation in `lib/api-client-react/src/custom-fetch.ts` already handles most of this — this slice adds testability, documentation, and a formal adapter boundary.

End-to-end: define `ApiClientFactory` and `TokenProvider` interfaces → refactor `customFetch` to use them internally → create a fake `NetworkAdapter` for tests → add unit tests for response normalisation, token injection, runtime adapter behavior, and error classification → verify generated client code and direct `classifyImage`/VTO callers continue to work.

## Acceptance criteria

- [ ] `ApiClientFactory` creates configured fetch functions given a `TokenProvider` and `baseUrl`
- [ ] `TokenProvider` interface formalised (replacing the current `AuthTokenGetter` type)
- [ ] `ApiError` and `ResponseParseError` error types remain backwards-compatible
- [ ] Fake `InMemoryNetworkAdapter` supports canned responses for deterministic testing
- [ ] Runtime adapter abstraction isolates RN-specific vs browser-specific behavior (e.g., `response.body === null` vs `undefined`)
- [ ] Unit tests cover: token injection, base URL resolution, response parsing (JSON, text, blob, empty), error classification, GET-with-body rejection
- [ ] Existing consumers (`GarmentContext.classifyImage`, `vto.ts callVTO`, generated clients) work without changes

## Blocked by

None — can start immediately.

## User stories addressed

- User story 1 (single-place configuration)
- User story 2 (deterministic parsing rules)
- User story 3 (fake token provider and network adapter for tests)
- User story 4 (runtime adapters for RN vs browser)
- User story 5 (staging base URL)
- User story 6 (normalised auth failure errors)
- User story 7 (reduce duplicated content negotiation)
