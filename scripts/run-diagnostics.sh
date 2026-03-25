#!/bin/bash

# SaaS Platform Diagnostic Script
# Identifies which services have issues

TEXT_BOLD="\033[1m"
TEXT_GREEN="\033[32m"
TEXT_RED="\033[31m"
TEXT_YELLOW="\033[33m"
TEXT_RESET="\033[0m"
FAILED=0


echo -e "${TEXT_BOLD}🔍 SaaS Platform Diagnostic Report${TEXT_RESET}\n"

# 1. Check Docker containers
echo -e "${TEXT_BOLD}1️⃣ Docker Containers Status:${TEXT_RESET}"
docker ps --filter "name=saas" --format "table {{.Names}}\t{{.Status}}" || echo "Docker not running"
echo ""

# 2. Check Database
echo -e "${TEXT_BOLD}2️⃣ Database Schema Check:${TEXT_RESET}"
echo "Tables in saas_db:"
docker exec saas_postgres psql -U saas_user -d saas_db -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" 2>/dev/null || { echo "❌ Cannot connect to DB"; FAILED=1; }
echo ""

# 3. Check for usage_logs table
echo -e "${TEXT_BOLD}3️⃣ Usage Tracking Table:${TEXT_RESET}"
docker exec saas_postgres psql -U saas_user -d saas_db -c "\d usage_logs" 2>/dev/null && echo -e "${TEXT_GREEN}✅ usage_logs table exists${TEXT_RESET}" || { echo -e "${TEXT_RED}❌ usage_logs table NOT found${TEXT_RESET}"; FAILED=1; }
echo ""

# 4. Check for idempotency_keys table
echo -e "${TEXT_BOLD}4️⃣ Idempotency Table:${TEXT_RESET}"
docker exec saas_postgres psql -U saas_user -d saas_db -c "\d idempotency_keys" 2>/dev/null && echo -e "${TEXT_GREEN}✅ idempotency_keys table exists${TEXT_RESET}" || { echo -e "${TEXT_RED}❌ idempotency_keys table NOT found${TEXT_RESET}"; FAILED=1; }
echo ""

# 5. Test endpoints
echo -e "${TEXT_BOLD}5️⃣ Endpoint Availability:${TEXT_RESET}"

# Use exported $TOKEN if available, otherwise generate a new one
if [ -n "$TOKEN" ]; then
  TEST_TOKEN="$TOKEN"
else
  TEST_TENANT=$(curl -s --max-time 10 -X POST "http://localhost:3000/api/tenants" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"test-diag-$(date +%s)\"}" | grep -o '"tenant_id":"[^\"]*' | cut -d'"' -f4)
  TEST_EMAIL="test-diagnostic-$(date +%s)@example.com"
  curl -s --max-time 10 -X POST "http://localhost:3000/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\", \"password\":\"password123\", \"tenantId\":\"$TEST_TENANT\"}" > /dev/null
  TEST_TOKEN=$(curl -s --max-time 10 -X POST "http://localhost:3000/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\", \"password\":\"password123\"}" | grep -o '"token":"[^\"]*' | cut -d'"' -f4)
fi

echo "Testing /api/billing/usage:"
USAGE_RESP=$(curl -s --max-time 10 -X GET "http://localhost:3000/api/billing/usage" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$USAGE_RESP" | tail -n 1)
BODY=$(echo "$USAGE_RESP" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${TEXT_GREEN}✅ Endpoint exists (200)${TEXT_RESET}"
    echo "   Response: $BODY"
else
    echo -e "${TEXT_RED}❌ Endpoint returned $HTTP_CODE${TEXT_RESET}"
    echo "   Response: $BODY"
    FAILED=1
fi
echo ""

# 6. Check middleware files
echo -e "${TEXT_BOLD}6️⃣ Middleware Files:${TEXT_RESET}"
echo "Checking idempotencyMiddleware.js:"
[ -f "shared/middleware/idempotencyMiddleware.js" ] && echo -e "${TEXT_GREEN}✅ File exists${TEXT_RESET}" || { echo -e "${TEXT_RED}❌ File NOT found${TEXT_RESET}"; FAILED=1; }

echo "Checking usageMiddleware.js:"
[ -f "shared/middleware/usageMiddleware.js" ] && echo -e "${TEXT_GREEN}✅ File exists${TEXT_RESET}" || { echo -e "${TEXT_RED}❌ File NOT found${TEXT_RESET}"; FAILED=1; }

echo "Checking rate limiting in api-gateway:"
grep -r "rate" api-gateway/src/ 2>/dev/null && echo -e "${TEXT_GREEN}✅ Rate limiting code found${TEXT_RESET}" || { echo -e "${TEXT_RED}❌ Rate limiting code NOT found${TEXT_RESET}"; FAILED=1; }
echo ""

echo -e "${TEXT_BOLD}✨ Diagnostic report complete${TEXT_RESET}"
echo -e "See ${TEXT_BOLD}DEBUG_ISSUES.md${TEXT_RESET} for detailed fix instructions"
echo ""

exit $FAILED
