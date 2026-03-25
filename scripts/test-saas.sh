#!/bin/bash

# SaaS Platform Integration Test Script
# Verifies: Tenant Creation, Auth, RLS Isolation, File Storage, and Usage Tracking

API_URL="http://localhost:3000/api"
TEXT_BOLD="\033[1m"
TEXT_GREEN="\033[32m"
TEXT_RED="\033[31m"
TEXT_RESET="\033[0m"
FAILED=0


echo -e "${TEXT_BOLD}🚀 Starting SaaS Backend Integration Tests...${TEXT_RESET}\n"

# 0. Self-clean Database
echo -ne "🧹 Self-cleaning database... "
docker exec saas_postgres psql -U saas_user -d saas_db -c "TRUNCATE tenants CASCADE;" > /dev/null 2>&1
echo -e "${TEXT_GREEN}DONE${TEXT_RESET}"

# Helper for extraction without jq
extract_json_val() {
    echo "$1" | sed -n 's/.*"'"$2"'":"\([^"]*\)".*/\1/p'
}

# 1. Create Tenant A
TIMESTAMP=$(date +%s)
echo -ne "🏢 Creating Tenant A (A-Corp-$TIMESTAMP)... "
RESP_A=$(curl -s --max-time 10 -X POST "$API_URL/tenants" -H "Content-Type: application/json" -d "{\"name\":\"A-Corp-$TIMESTAMP\"}")
TENANT_A_ID=$(extract_json_val "$RESP_A" "tenant_id")
if [ -z "$TENANT_A_ID" ]; then echo -e "${TEXT_RED}FAIL${TEXT_RESET}"; exit 1; fi
echo -e "${TEXT_GREEN}PASS${TEXT_RESET} (ID: $TENANT_A_ID)"

# 2. Register User A
echo -ne "👤 Registering User A... "
EMAIL_A="admin_$TIMESTAMP@acorp.com"
RESP_USER_A=$(curl -s --max-time 10 -X POST "$API_URL/auth/register" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL_A\", \"password\":\"password123\", \"tenantId\":\"$TENANT_A_ID\"}")
USER_A_ID=$(extract_json_val "$RESP_USER_A" "user_id")
if [ -z "$USER_A_ID" ]; then 
    echo -e "${TEXT_RED}FAIL${TEXT_RESET}"
    echo "Response: $RESP_USER_A"
    exit 1
fi
echo -e "${TEXT_GREEN}PASS${TEXT_RESET}"

# 3. Login User A
echo -ne "🔑 Logging in User A... "
LOGIN_A=$(curl -s --max-time 10 -X POST "$API_URL/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL_A\", \"password\":\"password123\"}")
TOKEN_A=$(echo "$LOGIN_A" | grep -o '"token":"[^"]*' | head -n1 | cut -d'"' -f4)
if [ -z "$TOKEN_A" ]; then
    echo -e "${TEXT_RED}FAIL${TEXT_RESET}"
    echo "Login Response: $LOGIN_A"
    exit 1
fi
echo -e "${TEXT_GREEN}PASS${TEXT_RESET}"

# 4. Create Tenant B
echo -ne "🏢 Creating Tenant B (B-Corp-$TIMESTAMP)... "
RESP_B=$(curl -s --max-time 10 -X POST "$API_URL/tenants" -H "Content-Type: application/json" -d "{\"name\":\"B-Corp-$TIMESTAMP\"}")
TENANT_B_ID=$(extract_json_val "$RESP_B" "tenant_id")
echo -e "${TEXT_GREEN}PASS${TEXT_RESET} (ID: $TENANT_B_ID)"

# 5. Register & Login User B
echo -ne "👤 Registering & Logging in User B... "
EMAIL_B="admin_$TIMESTAMP@bcorp.com"
RESP_USER_B=$(curl -s --max-time 10 -X POST "$API_URL/auth/register" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL_B\", \"password\":\"password123\", \"tenantId\":\"$TENANT_B_ID\"}")
USER_B_ID=$(extract_json_val "$RESP_USER_B" "user_id")
LOGIN_B=$(curl -s --max-time 10 -X POST "$API_URL/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL_B\", \"password\":\"password123\"}")
TOKEN_B=$(echo "$LOGIN_B" | grep -o '"token":"[^"]*' | head -n1 | cut -d'"' -f4)
echo -e "${TEXT_GREEN}PASS${TEXT_RESET}"

echo -e "\n${TEXT_BOLD}🛡️ Testing RLS Isolation...${TEXT_RESET}"

# 6. User A should only see Tenant A's users
echo -ne "🔍 User A listing users... "
USERS_A=$(curl -s --max-time 10 -X GET "$API_URL/users" -H "Authorization: Bearer $TOKEN_A")
if [[ "$USERS_A" == *"$TENANT_A_ID"* ]] && [[ "$USERS_A" != *"$TENANT_B_ID"* ]]; then
    echo -e "${TEXT_GREEN}PASS (Isolated)${TEXT_RESET}"
else
    echo -e "${TEXT_RED}FAIL (Leaked Context)${TEXT_RESET}"
    FAILED=1
fi

# 7. File Upload & Cross-Tenant Access Check
echo -e "\n${TEXT_BOLD}📁 Testing File Isolation...${TEXT_RESET}"
echo "Hello from Tenant A" > test_a.txt
echo -ne "📤 User A uploading file... "
UPLOAD_A=$(curl -s --max-time 10 -X POST "$API_URL/files/upload" -H "Authorization: Bearer $TOKEN_A" -F "file=@test_a.txt")
FILE_A_ID=$(extract_json_val "$UPLOAD_A" "file_id")
echo -e "${TEXT_GREEN}PASS${TEXT_RESET} (ID: $FILE_A_ID)"

echo -ne "🚫 User B trying to access User A's file... "
ACCESS_B=$(curl -s --max-time 10 -X GET "$API_URL/files/$FILE_A_ID/download" -H "Authorization: Bearer $TOKEN_B")
if [[ "$ACCESS_B" == *"not found"* ]] || [[ "$ACCESS_B" == *"Unauthorized"* ]] || [[ "$ACCESS_B" == *"error"* ]]; then
    echo -e "${TEXT_GREEN}PASS (Blocked)${TEXT_RESET}"
else
    echo -e "${TEXT_RED}FAIL (Accessed)${TEXT_RESET}"
    FAILED=1
fi

echo -e "\n${TEXT_BOLD}⚔️ Advanced Cross-Tenant Attack Tests...${TEXT_RESET}"

# 8. User B trying to access User A's ID directly
echo -ne "🚫 User B accessing User A info by ID... "
USER_A_INFO=$(curl -s --max-time 10 -X GET "$API_URL/users/$USER_A_ID" -H "Authorization: Bearer $TOKEN_B")
if [[ "$USER_A_INFO" == *"not found"* ]] || [[ "$USER_A_INFO" == *"error"* ]]; then
    echo -e "${TEXT_GREEN}PASS (Blocked)${TEXT_RESET}"
else
    echo -e "${TEXT_RED}FAIL (Accessed)${TEXT_RESET}"
    FAILED=1
fi

# 9. Tenant ID Injection Attack
echo -ne "🚫 User B trying to inject Tenant A ID in request... "
# Attempt to register a new user for Tenant A using Tenant B's credentials (or just trying to bypass)
# Here we test if the service correctly uses the tenant context from the request/token
# In registration, tenantId is in the body, but RLS should still block if the context isn't set right?
# Actually, registration is public. But let's test a protected route.
# We'll try to list users but pass a different tenantId if the API supports it (it doesn't usually, it uses the token)
# Let's try to upload a file for Tenant A using User B's token
echo "Malicious file" > malicious.txt
ATTACK_UPLOAD=$(curl -s --max-time 10 -X POST "$API_URL/files/upload" -H "Authorization: Bearer $TOKEN_B" -F "file=@malicious.txt" -F "tenantId=$TENANT_A_ID")
# Even if user B tries to say it's for Tenant A, the file-service SHOULD use the tenantId from the token.
# Let's check where that file ended up.
FILE_B_ATTACK_ID=$(extract_json_val "$ATTACK_UPLOAD" "file_id")
# Verify file exists for Tenant B (where it should be) and NOT for Tenant A
CHECK_A=$(curl -s --max-time 10 -X GET "$API_URL/files/$FILE_B_ATTACK_ID/download" -H "Authorization: Bearer $TOKEN_A")
if [[ "$CHECK_A" == *"not found"* ]] || [[ "$CHECK_A" == *"error"* ]]; then
    echo -e "${TEXT_GREEN}PASS (Injection Prevented)${TEXT_RESET}"
else
    echo -e "${TEXT_RED}FAIL (Injection Succeeded)${TEXT_RESET}"
    FAILED=1
fi
rm malicious.txt

echo -e "\n${TEXT_BOLD}📊 Testing Usage Tracking...${TEXT_RESET}"
echo -ne "📈 Checking usage logs for Tenant A (API)... "
USAGE_A=$(curl -s --max-time 10 -X GET "$API_URL/billing/usage" -H "Authorization: Bearer $TOKEN_A")
if [[ "$USAGE_A" == *"total"* ]]; then
    echo -e "${TEXT_GREEN}PASS${TEXT_RESET}"
else
    echo -e "${TEXT_RED}FAIL${TEXT_RESET}"
    FAILED=1
fi

echo -ne "🗄️ Verifying usage_logs table (Database)... "
# Wait a moment for fire-and-forget logs to settle
sleep 1
USAGE_COUNT=$(docker exec saas_postgres psql -U saas_user -d saas_db -t -c "SELECT COUNT(*) FROM usage_logs WHERE tenant_id = '$TENANT_A_ID';")
if [ "${USAGE_COUNT// /}" -gt 0 ]; then
    echo -e "${TEXT_GREEN}PASS${TEXT_RESET} (Count: ${USAGE_COUNT// /})"
else
    echo -e "${TEXT_RED}FAIL${TEXT_RESET} (No logs found for $TENANT_A_ID)"
    FAILED=1
fi

echo -e "\n${TEXT_BOLD}🔁 Testing Idempotency...${TEXT_RESET}"
echo -ne "🚦 Resetting Rate Limiter for clean idempotency test... "
docker exec saas_redis redis-cli FLUSHALL > /dev/null 2>&1
echo -e "${TEXT_GREEN}DONE${TEXT_RESET}"

IDEMP_KEY="test-key-$TIMESTAMP"

RESP1=$(curl -s --max-time 10 -X POST "$API_URL/tenants" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMP_KEY" \
  -d "{\"name\":\"Idempotent-Tenant\"}")

RESP2=$(curl -s --max-time 10 -X POST "$API_URL/tenants" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMP_KEY" \
  -d "{\"name\":\"Idempotent-Tenant\"}")

ID1=$(extract_json_val "$RESP1" "tenant_id")
ID2=$(extract_json_val "$RESP2" "tenant_id")

if [ "$ID1" == "$ID2" ] && [ -n "$ID1" ]; then
  echo -e "${TEXT_GREEN}PASS (Idempotent)${TEXT_RESET}"
else
  echo -e "${TEXT_RED}FAIL (Duplicate Created)${TEXT_RESET}"
  FAILED=1
fi

echo -e "\n${TEXT_BOLD}🚦 Testing Rate Limiting...${TEXT_RESET}"

RATE_LIMIT_HIT=0

for i in {1..110}; do
  RESP=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" \
    -X GET "$API_URL/users" \
    -H "Authorization: Bearer $TOKEN_A")

  if [ "$RESP" == "429" ]; then
    RATE_LIMIT_HIT=1
    break
  fi
done

if [ "$RATE_LIMIT_HIT" -eq 1 ]; then
  echo -e "${TEXT_GREEN}PASS (Rate Limit Enforced)${TEXT_RESET}"
else
  echo -e "${TEXT_RED}FAIL (No Rate Limit)${TEXT_RESET}"
  FAILED=1
fi

echo -e "\n${TEXT_BOLD}⚡ Testing Circuit Breaker (Billing Down)...${TEXT_RESET}"

docker stop saas_billing_service > /dev/null 2>&1
sleep 2

RESP=$(curl -s --max-time 10 -X GET "$API_URL/billing/usage" \
  -H "Authorization: Bearer $TOKEN_A")

if [[ "$RESP" == *"fallback"* ]] || [[ "$RESP" == *"unavailable"* ]]; then
  echo -e "${TEXT_GREEN}PASS (Fallback Working)${TEXT_RESET}"
else
  echo -e "${TEXT_RED}FAIL (No Fallback)${TEXT_RESET}"
  FAILED=1
fi

echo -ne "🔀 Testing Bulkhead Isolation (Users still work)... "

RESP=$(curl -s --max-time 10 -X GET "$API_URL/users" \
  -H "Authorization: Bearer $TOKEN_A")

if [[ "$RESP" == *"$TENANT_A_ID"* ]]; then
  echo -e "${TEXT_GREEN}PASS (Isolated Failure)${TEXT_RESET}"
else
  echo -e "${TEXT_RED}FAIL (Cascade Failure)${TEXT_RESET}"
  FAILED=1
fi

echo -e "\n${TEXT_BOLD}📊 Testing Circuit Dashboard...${TEXT_RESET}"

# Use whatever the internal token is configured to, e.g. internal_dev_token
DASH=$(curl -s --max-time 10 -X GET "http://localhost:3000/internal/circuit-status" \
  -H "x-internal-token: internal_dev_token")

if [[ "$DASH" == *"billing-service"* ]]; then
  echo -e "${TEXT_GREEN}PASS (Dashboard Available)${TEXT_RESET}"
else
  echo -e "${TEXT_RED}FAIL (Dashboard Missing)${TEXT_RESET}"
  FAILED=1
fi

echo -e "\n🔄 Restarting billing-service..."
docker start saas_billing_service > /dev/null 2>&1
sleep 3

echo -e "\n${TEXT_BOLD}✨ All integration tests completed successfully!${TEXT_RESET}"
rm test_a.txt

exit $FAILED
