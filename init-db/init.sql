-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Role Creation & Basic Privileges ────────────────────────────────
-- Create roles before they are used in policies

-- 1. Create limited application user
-- We use a fixed password for dev; in prod this would be an env var or IAM role
CREATE USER app_user WITH PASSWORD 'app_password';
GRANT CONNECT ON DATABASE saas_db TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- 2. Create dedicated auth user (bypasses RLS for credential lookup only)
-- Has no RLS applied — intentional, login must work before tenant is known
CREATE USER auth_user WITH PASSWORD 'auth_password' BYPASSRLS;
GRANT CONNECT ON DATABASE saas_db TO auth_user;
GRANT USAGE ON SCHEMA public TO auth_user;

-- ─── Tables ──────────────────────────────────────────────────────────

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
  tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Tenant features (feature flags per tenant)
CREATE TABLE IF NOT EXISTS tenant_features (
  tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  feature VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  PRIMARY KEY (tenant_id, feature)
);

-- Usage tracking
CREATE TABLE IF NOT EXISTS usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id UUID,
  api_name VARCHAR(100),
  method VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  plan VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  started_at TIMESTAMP DEFAULT NOW(),
  renewed_at TIMESTAMP DEFAULT NOW()
);

-- Files metadata
CREATE TABLE IF NOT EXISTS files (
  file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id UUID,
  original_name VARCHAR(500) NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- ─── Table-Specific Hardening ──────────────────────────────────────────

-- Grant application user permissions on tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- auth_user can only read the columns needed for login — nothing else
GRANT SELECT (user_id, tenant_id, email, password_hash, role, deleted_at) ON users TO auth_user;

-- auth_user also needs to read tenant status to check if account is suspended
GRANT SELECT (tenant_id, plan, status, deleted_at) ON tenants TO auth_user;

-- ─── Row-Level Security & Policies ───────────────────────────────────

-- Enable Row-Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_features ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
-- Note: We use app.current_tenant_id which must be set per session/transaction
-- CRITICAL: Policies are restricted TO app_user to allow auth_user to bypass them.
CREATE POLICY tenant_isolation_users ON users TO app_user 
  USING (tenant_id::text = current_setting('app.current_tenant_id', true) AND current_setting('app.current_tenant_id', true) <> '');

CREATE POLICY tenant_isolation_files ON files TO app_user 
  USING (tenant_id::text = current_setting('app.current_tenant_id', true) AND current_setting('app.current_tenant_id', true) <> '');

CREATE POLICY tenant_isolation_usage ON usage TO app_user 
  USING (tenant_id::text = current_setting('app.current_tenant_id', true) AND current_setting('app.current_tenant_id', true) <> '');

CREATE POLICY tenant_isolation_tenant_features ON tenant_features TO app_user 
  USING (tenant_id::text = current_setting('app.current_tenant_id', true) AND current_setting('app.current_tenant_id', true) <> '');

DROP POLICY IF EXISTS tenant_isolation_subscriptions ON subscriptions;
CREATE POLICY tenant_isolation_subscriptions
ON subscriptions
TO app_user
USING (tenant_id::text = current_setting('app.current_tenant_id', true) AND current_setting('app.current_tenant_id', true) <> '')
WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true) AND current_setting('app.current_tenant_id', true) <> '');

-- ─── Indexes ─────────────────────────────────────────────────────────

-- Indexes for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_tenant ON usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_files_tenant ON files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- ─── Force RLS for Table Owners ──────────────────────────────────────
-- By default, RLS is not applied to the table owner. FORCE RLS ensures
-- that even the superuser/owner is restricted unless they bypass RLS.
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE files FORCE ROW LEVEL SECURITY;
ALTER TABLE usage FORCE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_features FORCE ROW LEVEL SECURITY;
