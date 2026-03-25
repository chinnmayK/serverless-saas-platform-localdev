#!/bin/bash

# Unified SaaS Platform Test Runner
# Runs all integration and diagnostic tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"


echo "Waiting for Postgres to be ready..."
until docker exec saas_postgres pg_isready -U saas_user; do
  echo "Waiting for Postgres..."
  sleep 2
done
echo "Postgres is ready!"

# Get a valid JWT token and export it for use in tests
TOKEN=$(bash "$SCRIPT_DIR/get-valid-token.sh")
export TOKEN

# Run diagnostics (TOKEN available for endpoint tests)
bash "$SCRIPT_DIR/run-diagnostics.sh"

# Run integration tests (if needed, can use $TOKEN)
bash "$SCRIPT_DIR/test-saas.sh"

echo -e "\n\033[32;1m✅ ALL TESTS PASSED SUCCESSFULLY! 🚀\033[0m"
exit 0

