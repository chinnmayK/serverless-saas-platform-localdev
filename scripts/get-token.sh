#!/bin/bash
TIMESTAMP=$(date +%s)
TENANT_NAME="load-test-tenant-$TIMESTAMP"
TEST_EMAIL="loadtest-$TIMESTAMP@example.com"
TEST_PASSWORD="password123"

# Onboarding
ONBOARD_RESP=$(curl -s -X POST "http://localhost:3000/onboarding" \
    -H "Content-Type: application/json" \
    -d "{\"tenantName\":\"$TENANT_NAME\",\"adminEmail\":\"$TEST_EMAIL\",\"adminPassword\":\"$TEST_PASSWORD\"}" 2>/dev/null)

# Extract Token
TOKEN=$(echo "$ONBOARD_RESP" | grep -o '"token":"[^"]*' | cut -d'"' -f4 | head -n1 | tr -d '\r')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "FAILED"
    exit 1
fi

echo "$TOKEN"
