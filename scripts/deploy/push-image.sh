#!/usr/bin/env bash
# Push the API image to Google Artifact Registry.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=config.sh
source "${SCRIPT_DIR}/config.sh"

echo "Configuring docker for Artifact Registry ..."
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet

echo "Pushing ${IMAGE_URI} ..."
docker push "${IMAGE_URI}"

echo "Pushed ${IMAGE_URI}"
