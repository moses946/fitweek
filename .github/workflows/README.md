# GitHub Actions — API deploy

The `api-deploy.yml` workflow deploys the API to Cloud Run on push to `main` (when API paths change).

## Required GitHub secrets

| Secret | Description |
|--------|-------------|
| `GCP_PROJECT_ID` | Google Cloud project ID |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | WIF provider resource name |
| `GCP_SERVICE_ACCOUNT` | Deploy service account email |
| `DATABASE_URL` | Direct Postgres URL for migrations (port 5432) |

## Optional GitHub variables

| Variable | Default |
|----------|---------|
| `GCP_REGION` | `us-central1` |
| `CLOUD_RUN_SERVICE` | `fitweek-api` |
| `AR_REPOSITORY` | `fitweek` |
| `AR_IMAGE_NAME` | `api` |
| `SECRET_*` | See `scripts/deploy/config.sh` |

## Workload Identity Federation setup (recommended)

```bash
# Create WIF pool + provider linked to your GitHub repo
# Grant the service account:
#   roles/run.admin
#   roles/artifactregistry.writer
#   roles/secretmanager.secretAccessor
#   roles/iam.serviceAccountUser
```

See [Google's guide](https://github.com/google-github-actions/auth#setting-up-workload-identity-federation) for full WIF setup.

## CI workflow

`ci.yml` runs on all PRs and pushes to `main`: typecheck, fitweek tests, api-server build.
