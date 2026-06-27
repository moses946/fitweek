#!/usr/bin/env bash
# Shared deploy configuration. Source from other scripts or override via env.
set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${GCP_REGION:=us-central1}"

export GCP_PROJECT_ID GCP_REGION

# Artifact Registry
: "${AR_REPOSITORY:=fitweek}"
: "${AR_IMAGE_NAME:=api}"
export AR_REPOSITORY AR_IMAGE_NAME

IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"
export IMAGE_TAG

export IMAGE_URI="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${AR_REPOSITORY}/${AR_IMAGE_NAME}:${IMAGE_TAG}"

# Cloud Run
: "${CLOUD_RUN_SERVICE:=fitweek-api}"
export CLOUD_RUN_SERVICE

# Secret Manager secret names (must exist in GCP before deploy)
export SECRET_SUPABASE_URL="${SECRET_SUPABASE_URL:-fitweek-supabase-url}"
export SECRET_SUPABASE_SERVICE_ROLE_KEY="${SECRET_SUPABASE_SERVICE_ROLE_KEY:-fitweek-supabase-service-role-key}"
export SECRET_DATABASE_POOL_URL="${SECRET_DATABASE_POOL_URL:-fitweek-database-pool-url}"
export SECRET_OWM_API_KEY="${SECRET_OWM_API_KEY:-fitweek-owm-api-key}"
export SECRET_GOOGLE_CLOUD_VISION_API_KEY="${SECRET_GOOGLE_CLOUD_VISION_API_KEY:-fitweek-google-vision-api-key}"
export SECRET_RESET_PASSWORD_REDIRECT_URL="${SECRET_RESET_PASSWORD_REDIRECT_URL:-fitweek-reset-password-redirect-url}"
