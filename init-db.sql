-- =============================================================================
-- UNIFIED SaaS Platform Database Initialization
-- Single file containing: schema, RLS policies, roles, grants, tables, indexes
-- Run once on initial database setup - PostgreSQL handles idempotency with IF NOT EXISTS
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- SECTION 0: SCHEMA MIGRATIONS (Legacy Support)
-- =============================================================================
-- Handle renaming of legacy "id" columns to their entity-specific names.
-- This ensures smooth deployments where tables already exist with old structures.
DO $$ 
BEGIN 
    -- 1. Tenants table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='id') THEN
        ALTER TABLE tenants RENAME COLUMN id TO tenant_id;
        RAISE NOTICE 'Renamed id to tenant_id on tenants table';
    END IF;

    -- 2. Users table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='id') THEN
        ALTER TABLE users RENAME COLUMN id TO user_id;
        RAISE NOTICE 'Renamed id to user_id on users table';
    END IF;

    -- 3. Files table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='files' AND column_name='id') THEN
        ALTER TABLE files RENAME COLUMN id TO file_id;
        RAISE NOTICE 'Renamed id to file_id on files table';
    END IF;

    -- 4. Subscriptions table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='id') THEN
        ALTER TABLE subscriptions RENAME COLUMN id TO subscription_id;
        RAISE NOTICE 'Renamed id to subscription_id on subscriptions table';
    END IF;
END $$;

-- =============================================================================
-- SECTION 1: ROLE CREATION & AUTHENTICATION
-- =============================================================================

-- Create application user (runs with RLS enforced)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE USER app_user WITH PASSWORD 'app_password';
        RAISE NOTICE 'Created role app_user';
    END IF;
END
$$;

-- Create auth user (bypasses RLS for credential lookup only)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auth_user') THEN
        CREATE USER auth_user WITH PASSWORD 'auth_password' BYPASSRLS;
        RAISE NOTICE 'Created role auth_user';
    END IF;
END
$$;

-- Grant basic connection privileges
GRANT CONNECT ON DATABASE saas_db TO app_user;
GRANT CONNECT ON DATABASE saas_db TO auth_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT USAGE ON SCHEMA public TO auth_user;

-- =============================================================================
-- SECTION 2: TABLE CREATION
-- =============================================================================

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'free',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Tenant features (feature flags per tenant)
CREATE TABLE IF NOT EXISTS tenant_features (
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    feature VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (tenant_id, feature)
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    started_at TIMESTAMP DEFAULT NOW(),
    renewed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Files metadata table
CREATE TABLE IF NOT EXISTS files (
    file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Usage logs table (NEW - for tracking all API calls)
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INT,
    response_time_ms INT,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Idempotency keys table (for POST request deduplication)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL UNIQUE,
    response JSONB NOT NULL,
    status_code INT NOT NULL DEFAULT 200,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
);

-- Plans catalogue
CREATE TABLE IF NOT EXISTS plans (
  id         TEXT PRIMARY KEY,          -- 'free' | 'pro' | 'enterprise'
  price_usd  NUMERIC(10,2) NOT NULL DEFAULT 0,
  quota_requests_per_min  INT NOT NULL,
  quota_storage_bytes     BIGINT NOT NULL,
  stripe_price_id         TEXT          -- filled after Stripe setup
);

INSERT INTO plans (id, price_usd, quota_requests_per_min, quota_storage_bytes)
VALUES
  ('free',       0.00,  100,         10485760),    -- 10 MB
  ('pro',       10.00, 1000,       1073741824),    -- 1 GB
  ('enterprise', 0.00, 10000, 107374182400)         -- 100 GB
ON CONFLICT (id) DO NOTHING;

-- Add Stripe fields to tenants if not present
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- Add admin flag to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure plan column has NOT NULL constraint (it already has DEFAULT 'free')
ALTER TABLE tenants ALTER COLUMN plan SET NOT NULL;

-- Legacy usage table (kept for backwards compatibility)
CREATE TABLE IF NOT EXISTS usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    api_name VARCHAR(100),
    method VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- SECTION 3: INDEXES (for query performance)
-- =============================================================================

-- Tenant-related indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- User-related indexes
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);

-- File-related indexes
CREATE INDEX IF NOT EXISTS idx_files_tenant ON files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_files_tenant_user ON files(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);

-- Usage tracking indexes
CREATE INDEX IF NOT EXISTS idx_usage_logs_tenant ON usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_tenant_timestamp ON usage_logs(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_endpoint ON usage_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_usage_tenant ON usage(tenant_id);

-- Subscription-related indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Idempotency indexes
CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_keys(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at ON idempotency_keys(expires_at);

-- =============================================================================
-- SECTION 4: ROW-LEVEL SECURITY (RLS) SETUP
-- =============================================================================

-- Enable RLS on all sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_features ENABLE ROW LEVEL SECURITY;

-- Force RLS even for superusers/table owners
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE files FORCE ROW LEVEL SECURITY;
ALTER TABLE usage_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE usage FORCE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_features FORCE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans FORCE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent setup)
DROP POLICY IF EXISTS users_tenant_isolation ON users;
DROP POLICY IF EXISTS files_tenant_isolation ON files;
DROP POLICY IF EXISTS usage_logs_tenant_isolation ON usage_logs;
DROP POLICY IF EXISTS usage_tenant_isolation ON usage;
DROP POLICY IF EXISTS subscriptions_tenant_isolation ON subscriptions;
DROP POLICY IF EXISTS tenant_features_tenant_isolation ON tenant_features;

-- Create tenant isolation policies (applied only to app_user)
-- Users can only see/modify users in their tenant
CREATE POLICY users_tenant_isolation ON users TO app_user
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- Files can only be accessed by users in the same tenant
CREATE POLICY files_tenant_isolation ON files TO app_user
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- Usage logs can only be queried by the owning tenant
CREATE POLICY usage_logs_tenant_isolation ON usage_logs TO app_user
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- Usage (legacy) table RLS
CREATE POLICY usage_tenant_isolation ON usage TO app_user
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- Subscriptions isolation
CREATE POLICY subscriptions_tenant_isolation ON subscriptions TO app_user
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- Tenant features isolation
CREATE POLICY tenant_features_tenant_isolation ON tenant_features TO app_user
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- Plans table public read access (no tenant isolation needed for catalogue)
DROP POLICY IF EXISTS plans_read_all ON plans;
CREATE POLICY plans_read_all ON plans TO app_user, auth_user
    USING (true);

-- =============================================================================
-- SECTION 5: GRANTS & PERMISSIONS
-- =============================================================================

-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- Grant permissions on existing tables for app_user (with RLS enforced)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- auth_user: only read credentials, bypasses RLS
-- These tables don't have RLS applied to auth_user because they're marked with TO app_user
-- But we grant selective read access for login
GRANT SELECT ON tenants TO auth_user;
GRANT SELECT ON users TO auth_user;
GRANT SELECT ON plans TO app_user, auth_user;

-- auth_user: specific columns only for login operations
-- This is optional but recommended for security (principle of least privilege)
-- Note: PostgreSQL doesn't support column-level grants, so we use views if needed
-- For now, we give full SELECT on the tables but auth_user still can't modify

GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_keys TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON usage_logs TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON usage TO app_user;

-- =============================================================================
-- SECTION 6: CLEANUP & MAINTENANCE
-- =============================================================================

-- Drop legacy table if migration is complete (commented out - keep for safety)
-- DROP TABLE IF EXISTS usage CASCADE;

-- Analyze tables after setup for query optimizer
ANALYZE tenants;
ANALYZE users;
ANALYZE files;
ANALYZE usage_logs;
ANALYZE idempotency_keys;
ANALYZE subscriptions;
ANALYZE tenant_features;
ANALYZE plans;

-- =============================================================================
-- SECTION 7: VERIFICATION QUERIES (for debugging)
-- =============================================================================

-- Verify all tables exist
SELECT 
    c.relname AS tablename,
    (CASE WHEN c.relrowsecurity THEN 'YES' ELSE 'NO' END) AS rls_enabled,
    (CASE WHEN c.relforcerowsecurity THEN 'YES' ELSE 'NO' END) AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;

-- Verify RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- Verify user permissions
SELECT 
    grantee,
    privilege_type,
    table_name
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND grantee IN ('app_user', 'auth_user')
ORDER BY grantee, table_name, privilege_type;

-- =============================================================================
-- END OF INITIALIZATION
-- =============================================================================
-- This file is idempotent and can be safely re-run on existing databases.
-- All CREATE TABLE, CREATE INDEX, CREATE POLICY statements use IF NOT EXISTS.
-- Existing roles are preserved; only missing ones are created.