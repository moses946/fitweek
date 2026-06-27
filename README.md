# FitWeek Workspace

pnpm workspace monorepo using TypeScript. Contains a React Native (Expo) mobile app and an Express API server deployed to Google Cloud Run.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (`artifacts/api-server`)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod, `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **Mobile**: Expo SDK 54 + Expo Router v6 + React Native 0.81
- **Deploy**: Cloud Run (API), EAS Build (Android)

## Artifacts

### `artifacts/fitweek` — FitWeek Mobile App

AI-powered wardrobe planner (standalone Android via EAS Build).

**Environment variables** (see `artifacts/fitweek/.env.example`):

- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (safe for client)
- `EXPO_PUBLIC_API_BASE_URL` — Cloud Run API URL (required for production builds)

Server-side keys (OpenAI Vision, OWM, etc.) live in `artifacts/api-server`, not the mobile client.

**Deep link scheme**: `fitweek://` (Google OAuth redirect: `fitweek://auth/callback`)

**Testing**: `pnpm --filter @workspace/fitweek test`

### `artifacts/api-server` — API Server

Express 5 server: auth middleware, garment classification, weather proxy, VTO, DB-backed CRUD.

**Health check**: `GET /api/healthz` (liveness), `GET /api/readyz` (readiness, DB ping)

## Local development

```bash
# Install dependencies
pnpm install

# Terminal 1 — API (requires PORT and .env in artifacts/api-server)
PORT=8080 pnpm --filter @workspace/api-server run dev

# Terminal 2 — Mobile (use your machine's LAN IP for a physical device)
cd artifacts/fitweek
EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP>:8080 pnpm dev
```

## Key commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run migrate` — apply DB migrations
- `pnpm --filter @workspace/fitweek test` — run FitWeek unit tests

## Deploy API (Cloud Run)

See `scripts/deploy/README.md` for manual deploy scripts and required GCP setup.

```bash
./scripts/deploy/build-image.sh
./scripts/deploy/push-image.sh
./scripts/deploy/migrate-db.sh
./scripts/deploy/deploy-api.sh
```

Or push to `main` to trigger GitHub Actions (`.github/workflows/api-deploy.yml`).

## Release Android (Play Store)

1. Set EAS secrets: `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
2. `pnpm --filter @workspace/fitweek run build:android`
3. Internal test on Play Console, then `eas submit --platform android`

See `artifacts/fitweek/docs/PLAY_STORE.md` and `artifacts/fitweek/docs/OAUTH.md`.

## Architecture

- Supabase for auth, storage, and Postgres
- OpenAI Vision and OWM weather proxied through `api-server` (keys never in the mobile client)
- VTO via external Gradio space (`yisol/IDM-VTON`)
