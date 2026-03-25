#!/bin/bash
# get-valid-token.sh
# Registers a new tenant and user, logs in, and prints a valid JWT token

API_URL="http://localhost:3000/api"
EMAIL="testuser-$(date +%s)@example.com"
PASSWORD="password123"

# 1. Create a new tenant
TENANT_RESP=$(curl -s --max-time 10 -X POST "$API_URL/tenants" -H "Content-Type: application/json" -d '{"name":"token-test-tenant-'$(date +%s)'"}')
TENANT_ID=$(echo "$TENANT_RESP" | grep -o '"tenant_id":"[^"]*' | cut -d'"' -f4)

# 2. Register a new user
USER_RESP=$(curl -s --max-time 10 -X POST "$API_URL/auth/register" -H "Content-Type: application/json" -d '{"email":"'$EMAIL'","password":"'$PASSWORD'","tenantId":"'$TENANT_ID'"}')

# 3. Login to get JWT token
LOGIN_RESP=$(curl -s --max-time 10 -X POST "$API_URL/auth/login" -H "Content-Type: application/json" -d '{"email":"'$EMAIL'","password":"'$PASSWORD'"}')
TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo "$TOKEN"
else
  echo "Failed to obtain token" >&2
  echo "--- TENANT_RESP ---" >&2
  echo "$TENANT_RESP" >&2
  echo "--- USER_RESP ---" >&2
  echo "$USER_RESP" >&2
  echo "--- LOGIN_RESP ---" >&2
  echo "$LOGIN_RESP" >&2
  exit 1
fi
