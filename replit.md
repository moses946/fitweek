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
Completed: **Issues 1–4** (Auth, Garment Ingestion, Status/Laundry, Weather + Suggestion Filter).

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

## Architecture Decisions

- Supabase for auth + storage + DB (managed by infra agent, credentials user-provided)
- OpenAI Vision API calls go through `api-server` (key never exposed to Expo client)
- OWM weather calls go through `api-server`
- `hasCompletedOnboarding` stored in AsyncStorage (local) + Supabase `users.model_image_url` (remote)
- VTO (virtual try-on) priority: dress/overalls → tops/shirts → skirts/trousers
