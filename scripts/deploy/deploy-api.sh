#!/usr/bin/env bash
# Deploy (or update) the API on Google Cloud Run with Secret Manager env vars.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=config.sh
source "${SCRIPT_DIR}/config.sh"

echo "Deploying ${CLOUD_RUN_SERVICE} with image ${IMAGE_URI} ..."

gcloud run deploy "${CLOUD_RUN_SERVICE}" \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --image="${IMAGE_URI}" \
  --platform=managed \
  --port=8080 \
  --cpu=2 \
  --memory=2Gi \
  --timeout=900 \
  --concurrency=20 \
  --min-instances=0 \
  --max-instances=10 \
  --allow-unauthenticated \
  --startup-probe=httpGet.path=/api/healthz,httpGet.port=8080,initialDelaySeconds=5,timeoutSeconds=5,periodSeconds=10,failureThreshold=3 \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="\
SUPABASE_URL=${SECRET_SUPABASE_URL}:latest,\
SUPABASE_SERVICE_ROLE_KEY=${SECRET_SUPABASE_SERVICE_ROLE_KEY}:latest,\
DATABASE_POOL_URL=${SECRET_DATABASE_POOL_URL}:latest,\
OWM_API_KEY=${SECRET_OWM_API_KEY}:latest,\
GOOGLE_CLOUD_VISION_API_KEY=${SECRET_GOOGLE_CLOUD_VISION_API_KEY}:latest,\
RESET_PASSWORD_REDIRECT_URL=${SECRET_RESET_PASSWORD_REDIRECT_URL}:latest"

SERVICE_URL="$(gcloud run services describe "${CLOUD_RUN_SERVICE}" \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --format='value(status.url)')"

echo "Deployed: ${SERVICE_URL}"
echo "Health: ${SERVICE_URL}/api/healthz"
echo "Ready:  ${SERVICE_URL}/api/readyz"
