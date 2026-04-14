# Serverless SaaS Platform - Postman Testing Guide

This guide provides step-by-step instructions and definitions to test all existing features across the microservices using Postman.

## 1. Environment Setup
Before starting, create a new Environment in Postman and add the following variables:
- `baseUrl`: `<your-alb-dns>` *(e.g., http://saas-staging-alb-1234.us-east-1.elb.amazonaws.com)*
- `token`: *(leave empty, will be populated after Onboarding or Login)*
- `tenantId`: *(leave empty, will be populated after Onboarding)*
- `userId`: *(leave empty, will be populated after Onboarding)*
- `fileId`: *(leave empty, will be populated after File Upload)*

Set the Authorization for the Collection/Folder to **Bearer Token** and set the Token value to `{{token}}`. (This will implicitly pass the token to all endpoints unless overridden).

---

## 2. Onboarding & Auth (Public Endpoints)

### 2.1. Onboard a New Tenant and Admin
Provisions a new tenant database schema, assigns the "free" plan, and creates an admin user.
- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/onboarding`
- **Auth:** No Auth
- **Headers:** `Content-Type: application/json`, `Idempotency-Key: <uuid>` (optional)
- **Body:**
```json
{
  "tenantName": "Acme Corp",
  "adminEmail": "admin@acme.com",
  "adminPassword": "Password123!",
  "adminName": "Admin User"
}
```
**Assertion:** Expect `201 Created`. Copy `tenant_id`, `user_id`, and `token` from the response to your Postman variables.

### 2.2. User Login
Logs in an existing user and returns a JWT token.
- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/auth/login`
- **Auth:** No Auth
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "email": "admin@acme.com",
  "password": "Password123!"
}
```
**Assertion:** Expect `200 OK`. The response string/token should be saved to your `{{token}}` variable.

---

## 3. Tenant Service Features

### 3.1. List Tenants
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/tenants`
- **Expected:** `200 OK` (Array of tenants)

### 3.2. Get Specific Tenant
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/tenants/{{tenantId}}`
- **Expected:** `200 OK`

### 3.3. Update Tenant Plan (Admin Only)
- **Method:** `PATCH`
- **URL:** `{{baseUrl}}/api/tenants/{{tenantId}}/plan`
- **Body:**
```json
{
  "plan": "pro"
}
```
- **Expected:** `200 OK`

### 3.4. Get Tenant Feature Flags
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/tenants/{{tenantId}}/features`
- **Expected:** `200 OK` (Array of features e.g. `file_upload`, `api_access`)

### 3.5. Tenant Activity Dashboard
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/dashboard/activity`
- **Expected:** `200 OK` (Returns recent usage logs/activity for the tenant)

---

## 4. User Service Features

### 4.1. Register Additional User (under same tenant)
- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/auth/register`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "tenantId": "{{tenantId}}",
  "email": "member@acme.com",
  "name": "Member User",
  "password": "Password123!",
  "isAdmin": false
}
```
- **Expected:** `201 Created`

### 4.2. List Users in Tenant
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/users`
- **Expected:** `200 OK`

### 4.3. Get Specific User
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/users/{{userId}}`
- **Expected:** `200 OK`

### 4.4. Delete User (Admin Only)
- **Method:** `DELETE`
- **URL:** `{{baseUrl}}/api/users/<new_user_id>`
- **Expected:** `200 OK`

---

## 5. File Service Features

> [!WARNING]
> **Note on File Service Routing Limitations:** Currently, `GET /api/files` (List Files) and `DELETE /api/files/:id` (Delete File) are directly implemented in `file-service/src/routes.js` but the API Gateway (`api-gateway/src/routes/files.js`) does **not** map them. They will hit a `404` at the gateway. Only `/upload` and `/:fileId/download` are accessible through the Gateway.

### 5.1. Upload File
- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/files/upload`
- **Headers:** *(Remove manual Content-Type header in Postman, let it set multipart/form-data boundary automatically)*
- **Body:** Select `form-data`.
  - Key: `file` (Type: **File**) -> Choose an image or text file.
- **Expected:** `201 Created`. Copy `file_id` to your `{{fileId}}` variable.

### 5.2. Get File Download URL
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/files/{{fileId}}/download`
- **Expected:** `200 OK`. Returns a pre-signed S3 download URL.

### 5.3. Dashboard Files Summary
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/dashboard/files`
- **Expected:** `200 OK` (Returns `total_files`, `total_size`, and `recent_files`).

---

## 6. Billing Service Features

### 6.1. Get Usage Summary
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/billing/usage`
- **Expected:** `200 OK` (Shows aggregate usage across endpoints).

### 6.2. Dashboard Usage
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/dashboard/usage`
- **Expected:** `200 OK` (Dashboard visualization data for requests per endpoint and per hour).

### 6.3. Dashboard Billing
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/dashboard/billing`
- **Expected:** `200 OK` (Current plan, quota, items used, and remaining quota).

### 6.4. Generate Invoice
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/billing/invoice`
- **Expected:** `200 OK` (Returns invoice details for the tenant).

### 6.5. Get Subscription
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/billing/subscription`
- **Expected:** `200 OK` or `404 Not Found` (if no Stripe subscription exists yet).

### 6.6. Create Checkout Session
- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/billing/create-checkout`
- **Body:** `{}` *(Empty JSON)*
- **Expected:** `200 OK`. Returns a Stripe checkout URL for the user to complete payment.

### 6.7. Stripe Webhook (No Auth - internal service mock/Stripe)
- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/billing/webhook`
- **Headers:** `Content-Type: application/json`
- **Body:** raw Stripe webhook payload.
- **Expected:** `200 OK` (Depends on the payload correctness, typically tested via Stripe CLI or mocked data).

---

## 7. Troubleshooting

### 500 Internal Server Error during Onboarding
If you receive a 500 error when hitting `POST /api/onboarding` and your service logs indicate a column name issue (e.g. `column "tenant_id" of relation "tenants" does not exist`), this means your ECS database schema is out-of-sync with the current codebase expectation of `tenant_id`.

**The Fix:** 
The platform is transitioning from generic `id` columns to `tenant_id` and `user_id` for clarity. To resolve this against an existing database, run the following SQL migration on your RDS instance:
```sql
ALTER TABLE tenants RENAME COLUMN id TO tenant_id;
ALTER TABLE users RENAME COLUMN id TO user_id;
ALTER TABLE files RENAME COLUMN id TO file_id;
ALTER TABLE subscriptions RENAME COLUMN id TO subscription_id;
```
If your deployment pipeline doesn't automatically execute `init-db.sql` against existing databases, you will need to apply this schema migration manually using a tool like pgAdmin or `psql` connected to your AWS RDS database.
