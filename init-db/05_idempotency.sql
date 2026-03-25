-- 05_idempotency.sql
-- Support for POST request idempotency and usage logs

-- 1. Idempotency Keys Table
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL UNIQUE,
    response JSONB NOT NULL,
    status_code INT NOT NULL DEFAULT 200,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_keys(idempotency_key);

-- 2. Usage Logs Table (Renamed from usage to usage_logs)
DROP TABLE IF EXISTS usage CASCADE;
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    user_id UUID,
    status_code INT,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- RLS for usage_logs
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_logs_tenant_isolation ON usage_logs
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE INDEX IF NOT EXISTS idx_usage_logs_tenant_timestamp ON usage_logs(tenant_id, timestamp DESC);

-- 3. Grants for app_user (crucial for services to insert/select)
GRANT SELECT, INSERT, UPDATE, DELETE ON usage_logs TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_keys TO app_user;

