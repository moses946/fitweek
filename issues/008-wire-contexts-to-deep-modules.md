## Parent PRD

`issues/prd.md` — All candidates (integration glue)

## What to build

Rewire the four React context providers (`AuthContext`, `OutfitSlotContext`, `GarmentContext`, `WeatherContext`) to delegate to the new deep modules extracted in issues 004–007. Each context becomes a thin React hook (~30–50 lines) that maps module state to React state and exposes the module's API through the existing hook interface. No UI component changes should be needed.

End-to-end: for each context → instantiate the corresponding deep module with production adapters → subscribe to module events for React state updates → replace inline logic with module method calls → verify all existing hook consumers render and behave identically → add thin integration tests asserting hook → module delegation.

## Acceptance criteria

- [ ] `AuthContext.tsx` reduced from ~445 lines to ~50 lines, delegating to `AuthStore`
- [ ] `OutfitSlotContext.tsx` reduced from ~206 lines to ~40 lines, delegating to `OutfitSlotStore`
- [ ] `GarmentContext.tsx` reduced from ~200 lines to ~40 lines, delegating to `SuggestionEngine` + `GarmentRepository`
- [ ] All four context providers instantiate deep modules with production adapters (real AsyncStorage, real Supabase, real expo-notifications, real fetch)
- [ ] Existing hook interfaces (`useAuth()`, `useOutfitSlots()`, `useGarments()`) remain unchanged — no UI component modifications required
- [ ] Direct `AsyncStorage` imports removed from all context files (replaced by Storage Adapter)
- [ ] Integration tests for each context shim verify hook → module delegation with fake adapters
- [ ] App boots and all screens render correctly after migration

## Blocked by

- Blocked by `issues/004-extract-auth-store.md`
- Blocked by `issues/005-extract-outfit-slot-store.md`
- Blocked by `issues/006-extract-suggestion-engine.md`
- Blocked by `issues/007-extract-vto-orchestrator.md`

## User stories addressed

All user stories from Candidates 1–7 — this is the integration point where deep modules meet React UI.
