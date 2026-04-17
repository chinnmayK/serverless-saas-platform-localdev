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
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "tenantName": "Acme Corp",
  "adminEmail": "admin@acme.com",
  "adminPassword": "Password123!",
  "adminName": "Admin User"
}
```
**Assertion:** Expect `201 Created`. Copy `tenantId`, `userId`, and `token` from the response `data` object to your Postman variables.

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
**Assertion:** Expect `200 OK`. The `token` string in the response `data` should be saved to your `{{token}}` variable.

---

## 3. Tenant Service Features

### 3.1. List Tenants
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/tenants`
- **Expected:** `200 OK` (Array of tenants in `data`)

### 3.2. Get Specific Tenant
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/tenants/{{tenantId}}`
- **Expected:** `200 OK` (Tenant object in `data`)

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
- **Expected:** `201 Created`. Copy `userId` from the `data` object.

### 4.2. List Users in Tenant
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/users`
- **Expected:** `200 OK`

### 4.3. Get Specific User
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/users/{{userId}}`
- **Expected:** `200 OK`

---

## 5. File Service Features

### 5.1. Upload File
- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/files/upload`
- **Body:** Select `form-data`.
  - Key: `file` (Type: **File**) -> Choose an image or text file.
- **Expected:** `201 Created`. Copy `fileId` from the `data` object.

### 5.2. Get File Download URL
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/files/{{fileId}}/download`
- **Expected:** `200 OK`. Returns a pre-signed S3 download URL in `data.url`.

### 5.3. Dashboard Files Summary
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/dashboard/files`
- **Expected:** `200 OK`. Returns `totalFiles`, `totalSize`, and `recentFiles` in `data`.

---

## 6. Billing Service Features

### 6.1. Get Usage Summary
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/billing/usage`
- **Expected:** `200 OK`

### 6.2. Dashboard Billing
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/dashboard/billing`
- **Expected:** `200 OK` (Current plan, quota, items used in `data`).

### 6.3. Create Checkout Session
- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/billing/create-checkout`
- **Body:** `{}`
- **Expected:** `200 OK`. Returns a Stripe checkout `url` in `data`.

---

## 7. Troubleshooting

### 500 Internal Server Error during Onboarding
If you receive a 500 error indicating `column "tenant_id" ... does not exist`, it means your DB schema uses legacy names.

**The Automated Fix (Preferred):**
The platform's migration runner fixes this on startup.
1.  **Redeploy API Gateway**: Ensure the latest code is pushed to ECS.
2.  **Check Logs**: Look for `✅ DB Migration applied successfully`.
3.  **Validate**: The runner will automatically rename `id` to `tenant_id` and ensure all entity IDs are correct.

### Terraform State Lock Error
If `terraform apply` fails with `Error acquiring the state lock`:
1.  **Identify Lock ID**: Copy the ID from the error message.
2.  **Unlock**: Run `terraform force-unlock <ID>` in the `infrastructure` directory.
3.  **Resume**: Re-run `terraform apply`.
