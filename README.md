# Serverless SaaS Platform — Local Dev

A fully local multi-tenant SaaS backend. No cloud required.
Four Node.js microservices, each in its own Docker container,
backed by PostgreSQL, Redis, and MinIO.

---

## Stack

| Component       | Technology              | Purpose                        |
|-----------------|-------------------------|-------------------------------|
| API Gateway     | Express (Clustered)     | Multi-core entry point, Limits |
| User Service    | Express (Clustered)     | Auth (JWT) + user management  |
| Tenant Service  | Express                 | Tenant CRUD + feature flags    |
| Billing Service | Express                 | Usage metering + invoices      |
| File Service    | Express + MinIO         | Tenant-scoped file storage     |
| Database        | PostgreSQL 15           | Pool-tuned (max 10) + RLS      |
| Cache / Limits  | Redis 7                 | Non-blocking Rate Limiting     |
| Monitoring      | Prometheus + Grafana    | Metrics & Visualization        |
| Tracing         | Jaeger                  | Distributed Request Tracing    |
| Object Storage  | MinIO                   | local S3-compatible storage    |

---

## Project Structure

```
saas-platform-local/
│
├── docker-compose.yml
├── init-db/
│   └── init.sql                  ← runs once on first postgres boot
│
├── shared/                       ← shared across all services (copied at build time)
│   ├── middleware/
│   │   ├── authMiddleware.js     ← validates JWT
│   │   └── tenantMiddleware.js   ← extracts tenantId from token
│   └── utils/
│       ├── db.js                 ← pg Pool wrapper
│       ├── logger.js             ← structured JSON logger
│       └── response.js           ← standard API response helpers
│
├── api-gateway/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       └── index.js              ← reverse proxy + rate limiting
│
├── tenant-service/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── routes.js
│       ├── service.js
│       └── repository.js
│
├── user-service/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── routes.js             ← /auth/* and /users/*
│       ├── service.js
│       └── repository.js
│
├── billing-service/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── routes.js
│       ├── billing.js            ← invoice generation
│       └── usageMeter.js         ← usage recording + aggregation
│
└── file-service/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── index.js
        ├── routes.js
        ├── storage.js            ← MinIO client + operations
        └── upload.js             ← multer config (memory storage)
```

---

## Quickstart

### 1. Start everything

```bash
docker compose up --build
```

First boot takes ~1 min. PostgreSQL runs `init.sql` automatically.

### 2. Verify all services are up

```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
```

### 3. Stop everything

```bash
docker compose down
```

### 4. Wipe all data and start fresh

```bash
docker compose down -v
docker compose up --build
```

---

## Web UIs

| Service         | URL                        |
|-----------------|----------------------------|
| API Gateway     | http://localhost:3000       |
| Grafana         | http://localhost:3005       |
| Prometheus      | http://localhost:9090       |
| Jaeger UI       | http://localhost:16686      |
| MinIO Console   | http://localhost:9001       |
| PostgreSQL      | localhost:5432 (psql)      |

**Default Credentials**:
- **Grafana**: `admin` / `admin`
- **MinIO**: `minio` / `minio123`
- **Postgres**: `app_user` / `app_password`

---

## Full API Walkthrough

All requests go through the gateway on **port 3000**.

### Step 1 — Create a Tenant

```bash
curl -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "plan": "pro"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "tenant_id": "uuid-here",
    "name": "Acme Corp",
    "plan": "pro",
    "status": "active",
    "created_at": "..."
  }
}
```

Save `tenant_id` for the next steps.

---

### Step 2 — Register a User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "<tenant_id>",
    "email": "admin@acme.com",
    "password": "secret123",
    "role": "admin"
  }'
```

---

### Step 3 — Login (get JWT)

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@acme.com", "password": "secret123"}'
```

Response includes a `token`. Use it as `Bearer <token>` in all subsequent requests.

---

### Step 4 — List Tenant Feature Flags

```bash
curl http://localhost:3000/api/tenants/<tenant_id>/features \
  -H "Authorization: Bearer <token>"
```

---

### Step 5 — Upload a File

```bash
curl -X POST http://localhost:3000/api/files/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/yourfile.pdf"
```

Files are stored in MinIO under `<tenantId>/<userId>/<timestamp>_<filename>`.

---

### Step 6 — List Files

```bash
curl http://localhost:3000/api/files \
  -H "Authorization: Bearer <token>"
```

---

### Step 7 — Download a File

```bash
curl http://localhost:3000/api/files/<file_id>/download \
  -H "Authorization: Bearer <token>"
```

Returns a pre-signed URL valid for 1 hour.

---

### Step 8 — View Usage

```bash
curl http://localhost:3000/api/billing/usage \
  -H "Authorization: Bearer <token>"
```

Optional query params: `?from=2024-01-01&to=2024-01-31`

---

### Step 9 — Generate Invoice

```bash
curl http://localhost:3000/api/billing/invoice \
  -H "Authorization: Bearer <token>"
```

Returns a simulated invoice with base charge + overage calculation.

---

### Step 10 — Upgrade Plan

```bash
curl -X PATCH http://localhost:3000/api/tenants/<tenant_id>/plan \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"plan": "enterprise"}'
```

---

## Rate Limiting

The API Gateway enforces per-tenant rate limits via Redis:

| Plan       | Limit           |
|------------|-----------------|
| free       | 60 req/min      |
| pro        | 500 req/min     |
| enterprise | 5000 req/min    |

Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

---

## Tenant Isolation

Every database table includes `tenant_id`. All queries are scoped:

```sql
WHERE tenant_id = $1   -- always filtered to the caller's tenant
```

The JWT token carries `tenantId`. `tenantMiddleware.js` enforces it on every
protected route — a user from Tenant A can never read Tenant B's data.

Files in MinIO are namespaced: `<tenantId>/...`

---

## Plans & Feature Flags

| Feature        | free | pro | enterprise |
|----------------|------|-----|------------|
| basic_upload   | ✓    | ✓   | ✓          |
| basic_api      | ✓    | ✓   | ✓          |
| analytics      |      | ✓   | ✓          |
| export         |      | ✓   | ✓          |
| ai_reports     |      |     | ✓          |
| sso            |      |     | ✓          |
| audit_logs     |      |     | ✓          |

Feature flags are seeded automatically when a tenant is created.
Upgrading a plan resets and re-seeds features for the new plan.

---

## Rate Limiting

The API Gateway implements **tenant-aware rate limiting** using Redis:

- **Default limits**: 100 requests per minute per tenant
- **Key strategy**: Rate limits are applied per `tenantId` (from JWT) or fallback to IP address
- **Health checks**: `/health` and `/status` endpoints are exempt from rate limiting
- **Fail-open**: If Redis is unavailable, requests are allowed (with warning logs)

### Rate Limit Headers

All rate-limited responses include:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2024-01-01T12:01:00.000Z
```

### Testing Rate Limits

Use the provided test scripts:

```bash
# Bash version
chmod +x scripts/test-rate-limiter.sh
./scripts/test-rate-limiter.sh

# Node.js version (cross-platform)
node scripts/test-rate-limiter.js

# With JWT token for authenticated requests
TOKEN="your_jwt_here" node scripts/test-rate-limiter.js
```

### Configuration

Rate limiting can be configured via environment variables:
- `REDIS_HOST`: Redis server host (default: localhost)
- `REDIS_PORT`: Redis server port (default: 6379)
- `REDIS_DB`: Redis database number (default: 0)

---

## Idempotency

Critical POST endpoints support **idempotent requests** to prevent duplicate operations:

### Supported Endpoints

- `POST /api/tenants` - Tenant creation
- `POST /api/auth/register` - User registration  
- `POST /billing/usage` - Usage event recording
- `POST /billing/internal/usage` - Internal usage recording

### Usage

Include an `Idempotency-Key` header with your requests:

```bash
curl -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-request-id-123" \
  -d '{"name": "Acme Corp", "domain": "acme.com"}'
```

### Behavior

- **First request**: Processes normally and caches the response
- **Duplicate requests**: Returns the cached response without re-processing
- **Key expiration**: Idempotency keys expire after 24 hours
- **Fail-open**: If the database is unavailable, requests proceed without caching

### Testing

```bash
# Test idempotency functionality
node scripts/test-idempotency.js
```

---

## Usage Tracking

The billing service provides comprehensive **usage analytics** for tenant monitoring:

### Endpoints

- `GET /billing/usage` - Usage summary with metrics and filtering
- `GET /billing/usage/events` - Raw usage events with pagination

### Usage Summary

Get aggregated usage statistics:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/billing/usage"
```

**Response includes:**
- **Summary**: Total requests, unique endpoints/users, average status code
- **By Metric**: Detailed breakdown by endpoint and method
- **Period**: Time range of the data

### Date Filtering

Filter usage by date range:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/billing/usage?startDate=2024-01-01&endDate=2024-01-31&limit=50"
```

**Query Parameters:**
- `startDate`: ISO date string (optional)
- `endDate`: ISO date string (optional)  
- `limit`: Maximum number of metrics to return (default: 100)

### Raw Events

Access individual usage events:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/billing/usage/events?limit=20&offset=0"
```

### Data Collection

Usage is automatically tracked for:
- All API requests through the gateway
- Tenant and user context
- Response status codes
- Timestamps

### Testing

```bash
# Test usage tracking functionality
node scripts/test-usage-tracking.js
```

---

## Ports Reference

| Service         | Port  |
|-----------------|-------|
| API Gateway     | 3000  |
| Tenant Service  | 3001  |
| User Service    | 3002  |
| Billing Service | 3003  |
| File Service    | 3004  |
| PostgreSQL      | 5432  |
| Redis           | 6379  |
| MinIO API       | 9000  |
| MinIO Console   | 9001  |

---

## 📖 Project Context & Resolution Log

For a complete history of the project's development, including specific issue resolutions and architectural deep dives, see the full [context.md](file:///c:/Users/dell/saas-platform-local/context.md).

### Recent Fixes & Improvements
The following issues were recently identified and resolved:
- **Database Initialization**: Fixed `docker-compose.yml` to ensure `05_idempotency.sql` is mounted and executed on startup.
- **Permission Issues**: Added `GRANT` statements to ensure `app_user` can access `usage_logs`.
- **API Reliability**: Fixed "socket hang up" in the billing service by adding proper async error handling.
- **Logging Fixes**: Corrected `logger.audit()` to `logger.info()` in the user service.
- **Unified Testing**: Created `test-all.sh` to consolidate diagnostics and integration tests.

### Detailed Shared Library (@saas/shared)
All microservices leverage a central shared library for consistent behavior:

**Utilities (`shared/utils/`):**
- `db.js`: Connection pools for `app_user` and `auth_user` with `AsyncLocalStorage` for context propagation.
- `logger.js`: Standardized JSON logging (info, error, warn, debug).
- `response.js`: Consistent REST API response formats.
- `circuitBreaker.js`: Implements the Circuit Breaker pattern for fault tolerance.
- `serviceClient.js`: Internal HTTP client with built-in circuit breaking.
- `redisRateLimiter.js`: Redis-backed token-bucket rate limiting.

**Middleware (`shared/middleware/`):**
- `authMiddleware.js`: JWT validation and user/tenant context extraction.
- `tenantMiddleware.js`: Injects `tenantId` into the database session for RLS.
- `usageMiddleware.js`: Automatic usage recording for every API request.
- `idempotencyMiddleware.js`: Request deduplication using the `idempotency_keys` table.
- `rbacMiddleware.js`: Role-based access control.

### Database Schema (RLS Enabled)
- `tenants`: Core tenant configuration.
- `users`: User accounts (tenant-scoped).
- `files`: File metadata (tenant-scoped).
- `usage_logs`: Aggregated request metrics.
- `idempotency_keys`: Storage for request deduplication.

### Environment Variables Reference
Key variables used across the platform:
```bash
DB_NAME=saas_db
DB_USER=app_user
AUTH_DB_USER=auth_user
JWT_SECRET=local_dev_jwt_secret_change_in_prod
INTERNAL_SERVICE_TOKEN=internal_dev_token_change_in_prod
REDIS_URL=redis://redis:6379
MINIO_ENDPOINT=minio
```

---

---

## Performance & Load Resilience

The platform is engineered for high-concurrency (500+ VUs) via several architectural optimizations:

### 1. Node.js Clustering
Services (Gateway, User) run in **Clustered Mode**, utilizing 4 workers per replica to scale across multiple CPU cores.

### 2. Non-Blocking Rate Limiting
The `redisRateLimiter.js` uses a **Background Quota Fetch** pattern. Requests are never blocked by database latency; quotas are refreshed asynchronously while allowing traffic based on safe defaults.

### 3. Database Pool Tuning
PostgreSQL pools are tuned for clustered environments:
- `max`: 10 connections per worker
- `statement_timeout`: 3000ms (prevents starvation)
- `connectionTimeout`: 2000ms

### 4. Service Level Objectives (SLOs)
Verified via the `load-tests/` k6 suite:
- **Baseline (50 VUs)**: p95 < 200ms
- **Under Load (200 VUs)**: p95 < 500ms
- **Spike (500 VUs)**: 0% real errors (5xx), p95 < 1000ms

---

## Observability

### Metrics (Prometheus)
Scrapes `/metrics` from the API Gateway. Tracks request rates, error codes, and **Redis latency**.

### Tracing (Jaeger)
Distributed tracing is enabled across the gateway and downstream services. Trace context is propagated via `traceparent` headers.

### Dashboards (Grafana)
Pre-configured for real-time monitoring of RPS, Latency, and Error rates.

---

## Testing & Verification

### Unified Test Runner
```bash
bash scripts/test-all.sh
```
Executes Stage 1-7 (Integration) and Stage 8 (Sequential k6 Load Tests).

---

*Last Updated: April 1, 2026 17:40 UTC*
