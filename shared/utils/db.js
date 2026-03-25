const { Pool } = require("pg");
const { AsyncLocalStorage } = require("async_hooks");
const logger = require("./logger");

// ─── Tenant Context Scope — Managed by AsyncLocalStorage ─────────────────────
const tenantContext = new AsyncLocalStorage();

// ─── Primary pool — app_user with RLS enforced ────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME     || "saas_db",
  user:     process.env.DB_USER     || "app_user",
  password: process.env.DB_PASSWORD || "app_password",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ─── Auth pool — auth_user, bypasses RLS, used ONLY for login ─────────────────
const authPool = new Pool({
  host:     process.env.DB_HOST          || "localhost",
  port:     parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME          || "saas_db",
  user:     process.env.AUTH_DB_USER     || "auth_user",
  password: process.env.AUTH_DB_PASSWORD || "auth_password",
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error",     (err) => logger.error("Pool error",      { error: err.message }));
authPool.on("error", (err) => logger.error("Auth pool error", { error: err.message }));

// ─── Query Logging Wrapper ──────────────────────────────────────────────────
const originalQuery = pool.query;

pool.query = async (...args) => {
  logger.debug('DB Query', { query: args[0], params: args[1] });

  try {
    const result = await originalQuery.apply(pool, args);
    return result;
  } catch (err) {
    logger.error('DB Error', { error: err.message, query: args[0] });
    throw err;
  }
};

// ─── Smart query — auto-applies RLS if tenant context is active ───────────────
const query = (text, params) => {
  const tenantId = tenantContext.getStore();
  if (tenantId) {
    return tenantQuery(tenantId, text, params);
  }
  return pool.query(text, params);
};

// ─── Auth-only query via auth_user (bypasses RLS, narrow SELECT only) ─────────
const authQuery = (text, params) => authPool.query(text, params);

// ─── Tenant-scoped transaction — SET LOCAL scopes setting to transaction ───────
async function withTenant(tenantId, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_tenant_id', $1, true)",
      [tenantId]
    );
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ─── Single tenant-scoped query (no multi-step atomicity needed) ───────────────
async function tenantQuery(tenantId, text, params) {
  const client = await pool.connect();
  try {
    // We wrap in a transaction so set_config(..., true) is safe and scoped
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_tenant_id', $1, true)",
      [tenantId]
    );
    const result = await client.query(text, params);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { 
  query, 
  authQuery, 
  withTenant, 
  tenantQuery, 
  tenantContext, 
  pool 
};
