# FitWeek API — Cloud Run deployment

Manual deploy scripts for the Express API. GitHub Actions (`.github/workflows/api-deploy.yml`) automates the same flow on push to `main`.

## Prerequisites

1. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud`) authenticated
2. GCP project with APIs enabled: Cloud Run, Artifact Registry, Secret Manager
3. Artifact Registry repository (default: `fitweek` in your region)
4. Secrets created in Secret Manager (see below)
5. Docker installed locally (for `build-image.sh`)

## Environment variables

Set before running scripts (or export in your shell profile):

```bash
export GCP_PROJECT_ID=your-gcp-project
export GCP_REGION=us-central1          # optional, default us-central1
export CLOUD_RUN_SERVICE=fitweek-api # optional
```

For migrations:

```bash
export DATABASE_URL=postgresql://...   # direct Postgres (port 5432), not pooler
```

Optional overrides for Secret Manager secret names: see `config.sh`.

## One-time GCP setup

```bash
# Enable APIs
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com \
  --project="${GCP_PROJECT_ID}"

# Create Artifact Registry repo
gcloud artifacts repositories create fitweek \
  --repository-format=docker \
  --location="${GCP_REGION}" \
  --project="${GCP_PROJECT_ID}"

# Create secrets (example — repeat for each secret)
echo -n "https://xxx.supabase.co" | gcloud secrets create fitweek-supabase-url \
  --data-file=- --project="${GCP_PROJECT_ID}"
```

### Required secrets

| Secret name (default) | Description |
|----------------------|-------------|
| `fitweek-supabase-url` | `SUPABASE_URL` |
| `fitweek-supabase-service-role-key` | `SUPABASE_SERVICE_ROLE_KEY` |
| `fitweek-database-pool-url` | `DATABASE_POOL_URL` (PgBouncer, port 6543) |
| `fitweek-owm-api-key` | OpenWeatherMap API key |
| `fitweek-google-vision-api-key` | Google Cloud Vision API key |
| `fitweek-reset-password-redirect-url` | Optional password-reset redirect |

Grant the Cloud Run service account `roles/secretmanager.secretAccessor` on each secret.

## Deploy flow

```bash
chmod +x scripts/deploy/*.sh

./scripts/deploy/build-image.sh
./scripts/deploy/push-image.sh
./scripts/deploy/migrate-db.sh      # requires DATABASE_URL
./scripts/deploy/deploy-api.sh
```

## Cloud Run settings

Default deploy flags (see `deploy-api.sh`):

| Setting | Value |
|---------|-------|
| CPU / memory | 2 vCPU, 2 GiB |
| Request timeout | 900s (VTO inference) |
| Concurrency | 20 |
| Startup probe | `GET /api/healthz` |

## Rollback

Redeploy a previous image tag:

```bash
export IMAGE_TAG=<previous-git-sha>
./scripts/deploy/deploy-api.sh
```

## Alerting

In Cloud Console → Logging → Log-based metrics, create an alert on 5xx response rate for the Cloud Run service. Link the metric to a notification channel (email, PagerDuty, etc.).
