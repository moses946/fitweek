#!/usr/bin/env bash
# Build the API Docker image for linux/amd64 (Cloud Run).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# shellcheck source=config.sh
source "${SCRIPT_DIR}/config.sh"

cd "${REPO_ROOT}"

echo "Building ${IMAGE_URI} ..."
docker build \
  --platform linux/amd64 \
  -t "${IMAGE_URI}" \
  -f Dockerfile \
  .

echo "Built ${IMAGE_URI}"
