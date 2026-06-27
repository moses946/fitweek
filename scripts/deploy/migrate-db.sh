#!/usr/bin/env bash
# Run Drizzle migrations against DATABASE_URL (direct Postgres, not pooler).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# shellcheck source=config.sh
source "${SCRIPT_DIR}/config.sh"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (direct connection, port 5432)." >&2
  exit 1
fi

cd "${REPO_ROOT}"

echo "Running database migrations ..."
pnpm --filter @workspace/db run migrate

echo "Migrations complete."
