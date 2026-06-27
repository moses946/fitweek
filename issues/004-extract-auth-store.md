## Parent PRD

`issues/prd.md` — Candidate 7 (Auth + Supabase Boundary)

## What to build

Extract an `AuthStore` deep module that owns session management, profile fetching, sign-in/sign-out flows, and auth-change event emission. Currently `AuthContext.tsx` (445 lines) is tightly coupled to the Supabase client — mixing OAuth flow orchestration, profile sync, storage calls, and React state management in one file. This slice pulls the non-React logic into a testable domain module.

End-to-end: define `AuthStore` API (`getSession`, `signIn`, `signOut`, `onAuthChange`, `getProfile`, `completeOnboarding`, `pickModelPhoto`, `updateBirthdate`) → implement a `SupabaseAuthAdapter` that wraps the Supabase client → implement a `FakeAuthAdapter` for tests → have `AuthStore` use the Storage Adapter (from `issues/001-harden-storage-adapter.md`) for per-user key management → reduce `AuthContext` to a thin React hook that delegates to the store → write unit tests for all auth flows using the fake adapter.

## Acceptance criteria

- [ ] `AuthStore` module exposes compact session-management API with event emission for auth state changes
- [ ] `SupabaseAuthAdapter` implements the auth adapter interface using the existing Supabase client
- [ ] `FakeAuthAdapter` enables deterministic testing of sign-in, sign-out, session expiry, and profile fetch
- [ ] `AuthStore` uses the Storage Adapter for per-user key management (onboarding flag, model URL) instead of direct AsyncStorage calls
- [ ] `AuthContext` reduced to a thin hook (~50 lines) that maps `AuthStore` state to React state
- [ ] Unit tests cover: sign-in success, sign-in failure, sign-out + cleanup, session restoration, profile sync, onboarding completion, auth change event emission
- [ ] OAuth flow (Google sign-in, PKCE, implicit) behavior is preserved end-to-end

## Blocked by

- Blocked by `issues/001-harden-storage-adapter.md` (AuthStore uses Storage Adapter for per-user keys)
- Blocked by `issues/003-extract-api-client-boundary.md` (profile sync uses API client)

## User stories addressed

- User story 1 (reliable sign-in/sign-out)
- User story 2 (accurate session state)
- User story 3 (fake AuthStore for tests)
- User story 4 (isolated token/session persistence)
- User story 5 (simulated failures in tests)
- User story 6 (clear auth change events)
