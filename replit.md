# FitWeek Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains a React Native (Expo) mobile app and an Express API server.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo SDK 54 + Expo Router v6 + React Native 0.81

## Artifacts

### `artifacts/fitweek` — FitWeek Mobile App
AI-powered wardrobe planner app (Expo Go + EAS Android builds).

**Feature scope (Issue 1 — Foundation + Auth):**
- Supabase Auth via Google OAuth (`expo-web-browser` + `expo-linking`)
- `AuthContext` — session, user, onboarding state, sign in/out
- Auth gate in root `_layout.tsx` using `useSegments` + `useRootNavigationState`
- Onboarding flow: model photo capture → Supabase Storage upload (with local fallback)
- 4-tab navigation: Closet, Planner, Laundry, Profile
- TDD tests: `__tests__/AuthContext.test.tsx` (6 tests, jest-expo preset)

**Environment variables** (`artifacts/fitweek/.env`):
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (safe for client)
- OpenAI and OWM keys go to `artifacts/api-server` (not the mobile client)

**Deep link scheme**: `fitweek://` (Google OAuth redirect: `fitweek://auth/callback`)

**Color palette** (constants/colors.ts):
- Background: `#F7F5F2` (warm cream)
- Primary: `#1A1A1A` (charcoal)
- Accent: `#C4A882` (sandy taupe)
- Status clean: `#34C759` / worn: `#FF9500` / laundry: `#FF3B30`

**Testing**: `pnpm --filter @workspace/fitweek test`

### `artifacts/api-server` — API Server
Express 5 server handling server-side logic (OpenAI Vision calls, OWM weather, auth middleware).

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/fitweek test` — run FitWeek unit tests

## Implementation Plan

See `fitweek-implementation-plan.md` for full vertical slice plan (7 issues).
Completed: **All 7 Issues** ✅ (Auth, Garment Ingestion, Status/Laundry, Weather + Suggestion Filter, Outfit Slots + Swipe Deck, VTO, Calendar Export + Share Card).

### Issue 4 — Weather Service + Suggestion Filter

**New lib files:**
- `lib/weather.ts` — `getWeatherForecast(lat,lon)` + `getWeatherForecastByCity(city)`, AsyncStorage cache (24h TTL), `ForecastResult` / `DailyForecast` types
- `lib/weatherFilter.ts` — `getSuggestableCategories(forecast)`, `isWeatherAppropriate()`, `ALL_CATEGORIES`
- `lib/suggestionFilter.ts` — `filterSuggestableWithWeather()`, `interleaveByCategory()`, `sortByRecency()`, `buildSuggestionDeck()`

**New context + components:**
- `contexts/WeatherContext.tsx` — GPS permission, fallback city, AsyncStorage city persistence, `useWeather()` hook
- `components/WeatherBadge.tsx` — compact (emoji + °C) and full (range + label) variants; `WeatherUnavailableBadge`

**Updated screens:**
- `app/(tabs)/planner.tsx` — week day strip with weather badges, location permission prompt, city input card, per-day override toggle, cached/unavailable banners
- `app/_layout.tsx` — `WeatherProvider` added inside `GarmentProvider`

**API Server:**
- `api-server/src/routes/weather.ts` — `GET /weather/forecast?lat&lon` or `?city`; proxies OWM 5-day/3-hour API, aggregates to daily; requires `OWM_API_KEY` env var

**Tests:** 67/67 passing across 5 suites (`weather.test.ts` Tests 1–3, `weatherFilter.test.ts` Tests 4–13)

### Issue 5 — Outfit Assembly + Swipe Deck (COMPLETE)

**New lib files:**
- `lib/outfitSlots.ts` — pure slot mutations: `createSlot`, `updateSlot`, `deleteSlot`, `confirmSlot`, `cleanupDraftSlots`, `markAllWornInSlot`
- `lib/outfitSlotNotifications.ts` — `computeNextSundayAt7pm()`, `scheduleSundayPlannerNotification()` (dynamic `expo-notifications` import, web-safe)

**New context:**
- `contexts/OutfitSlotContext.tsx` — `OutfitSlotProvider` (loads/persists slots via AsyncStorage, calls `useGarments()` for markWorn); `useOutfitSlots()` hook

**New components:**
- `components/SwipeCard.tsx` — Reanimated v4 + GestureDetector pan swipe card; left=skip, right=add to outfit; haptic feedback
- `components/OutfitAssemblyPanel.tsx` — bottom drawer showing assembled outfit garments for a date

**New screens:**
- `app/(swipe)/_layout.tsx` — swipe stack layout
- `app/(swipe)/[date].tsx` — full swipe deck screen; liveDeck + sessionPool; low-deck reintroduction (≤3 → requeue skipped)

**Updated screens:**
- `app/(tabs)/planner.tsx` — week grid with confirmed outfit cards per day; tap opens swipe deck
- `app/_layout.tsx` — `OutfitSlotProvider` added inside `GarmentProvider`, outside `WeatherProvider`

**Types:**
- `lib/types.ts` — `OutfitSlot`, `OutfitSlotStatus` added

**Package fix:**
- `expo-notifications` downgraded from `55.0.22` → `0.32.17` (correct version for Expo SDK 54)

**Tests:** 95/95 passing across 6 suites (`outfitSlots.test.ts` Tests 1–10 new; prior 85 intact)

### Issue 6 — Virtual Try-On (COMPLETE)

**New lib files:**
- `lib/vto.ts` — `selectHeroGarment(garments[])` (priority: dresses→tops→bottoms→outerwear), `callVTO(modelUri, garmentUri, desc, signal?)` (Gradio IDM-VTON REST API, AbortController timeout), `saveVTOResult(slots, slotId, url)` (pure slot update), `VtoError` class with `code: 'VTO_TIMEOUT'|'VTO_ERROR'`

**Context update:**
- `contexts/OutfitSlotContext.tsx` — `updateSlotVtoImage(slotId, url)` added (persists VTO URL to AsyncStorage)

**Updated screens:**
- `app/(tabs)/planner.tsx` — "Try on" / "Re-try on" button on confirmed outfit cards; full-screen VTO loading `Modal` with cancel (AbortController); VTO result image displayed above thumbnails with "Regenerate" overlay button; redirects to profile if model photo missing

**Tests:** `vto.test.ts` Tests 1–10 (selectHeroGarment priority, callVTO mock success/abort/error, null model, saveVTOResult)

**Packages:**
- `expo-file-system@~19.0.22`, `expo-sharing@~14.0.8` installed (correct SDK 54 versions)

### Issue 7 — Calendar Export + Share Card (COMPLETE)

**New lib files:**
- `lib/ics.ts` — `generateICS(slots, garments, forecast[])` (valid RFC 5545 iCal; soft-deleted garments silently omitted; auto-name via `autoName()` when slot.name=null), `generateShareCard(slot, garments, forecast?)` → `ShareCardData { type:'vto'|'collage', primaryImageUri, garmentImageUris, dayLabel, weatherSummary }`, `ICS_MIME_TYPE = 'text/calendar'`

**Updated screens:**
- `app/(tabs)/planner.tsx` — calendar export icon (📅) in header; writes `.ics` via `expo-file-system/legacy`, opens native share sheet via `expo-sharing`; "Share" button on each confirmed outfit card (native `Share.share()` with outfit text + VTO URL)

**Tests:** `ics.test.ts` Tests 1–8 (ICS structure, SUMMARY, DESCRIPTION, auto-name, soft-delete, share card vto/collage, MIME type)

**Final test count:** 113/113 across 8 suites — zero TypeScript errors

## Architecture Decisions

- Supabase for auth + storage + DB (managed by infra agent, credentials user-provided)
- OpenAI Vision API calls go through `api-server` (key never exposed to Expo client)
- OWM weather calls go through `api-server`
- `hasCompletedOnboarding` stored in AsyncStorage (local) + Supabase `users.model_image_url` (remote)
- VTO (virtual try-on) priority: dress/overalls → tops/shirts → skirts/trousers
