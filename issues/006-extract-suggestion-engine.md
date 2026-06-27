## Parent PRD

`issues/prd.md` — Candidate 2 (Garment Domain + Suggestion Pipeline)

## What to build

Introduce a Suggestion Engine deep module that encapsulates garment scoring, skip/worn/laundry semantics, weather filtering, and the deck-building pipeline. Currently this logic is split across `lib/garmentStatus.ts` (status transitions), `lib/suggestionFilter.ts` (filtering + interleaving), `lib/weatherFilter.ts` (weather appropriateness), and `contexts/GarmentContext.tsx` (classification + persistence). This slice unifies the scoring and filtering pipeline.

End-to-end: create `SuggestionEngine` with injected `ClassifierAdapter` (abstracts network image classification) and `GarmentRepository` (abstracts persistence) → move filtering pipeline (`isSuggestable`, `filterSuggestableWithWeather`, `interleaveByCategory`, `buildSuggestionDeck`) and status transitions (`markWorn`, `sendToLaundry`, `markWashed`, skip logic) into the engine → expose `buildDeck(context)` and `applyAction(garmentId, action)` → support configurable ranking weights for future A/B testing → write unit tests with deterministic fake classifier and in-memory repository.

## Acceptance criteria

- [ ] `SuggestionEngine` module owns scoring, filtering, status transitions, and deck construction
- [ ] Engine depends on injected `ClassifierAdapter` and `GarmentRepository` interfaces
- [ ] `buildDeck(context)` returns a compact suggestion deck ready for UI rendering
- [ ] `applyAction(garmentId, action)` supports: `skip`, `markWorn`, `sendToLaundry`, `markWashed`, `undo`, `revokeSkip`
- [ ] Engine accepts a config object for ranking weights and feature flags
- [ ] Engine returns changes without persisting — callers use the repository to persist (or use an optional convenience wrapper)
- [ ] Unit tests with fake classifier and in-memory repository cover: ranking, skip semantics, weather filtering, interleaving, edge cases (empty wardrobe, all-skipped, all-laundry)
- [ ] Existing `garmentStatus.test.ts`, `suggestionFilter.test.ts`, `weatherFilter.test.ts` tests pass or are folded into the engine test suite

## Blocked by

- Blocked by `issues/001-harden-storage-adapter.md` (GarmentRepository uses Storage Adapter)

## User stories addressed

- User story 1 (suggestions respect recent wears and skips)
- User story 2 (skip garment for week or session)
- User story 3 (suggestions update quickly after closet changes)
- User story 4 (single module for scoring and filtering)
- User story 5 (fake classifier in tests)
- User story 6 (feature-flag-driven weights for A/B)
- User story 7 (end-to-end tests for sample garment sets)
- User story 8 (metrics and logging hooks)
- User story 9 (compact deck representation)
- User story 10 (predictable boundary conditions)
