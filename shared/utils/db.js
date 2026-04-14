const { Pool } = require("pg");
const { AsyncLocalStorage } = require("async_hooks");
const logger = require("./logger");

// ─── Tenant Context Scope — Managed by AsyncLocalStorage ─────────────────────
const tenantContext = new AsyncLocalStorage();

// ─── BUG FIX #1 & #2: Build connection config from individual DB_* env vars
//     when DATABASE_URL is absent (local Docker). Enable SSL only in production.
// ─────────────────────────────────────────────────────────────────────────────
function buildConnectionConfig(overrides = {}) {
  // If DATABASE_URL is explicitly provided (e.g. AWS RDS), use it.
  // Otherwise construct from individual DB_* vars (Docker Compose).
  const base = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host:     process.env.DB_HOST     || "localhost",
        port:     parseInt(process.env.DB_PORT || "5432", 10),
        database: process.env.DB_NAME     || "saas_db",
        user:     process.env.DB_USER     || "app_user",
        password: process.env.DB_PASSWORD || "app_password",
      };

  // BUG FIX #2: Only enable SSL in production.
  // postgres:15-alpine (Docker) does not have SSL configured; forcing it
  // causes "The server does not support SSL connections" before any query runs.
  const ssl = process.env.NODE_ENV === "production" || process.env.DB_SSL === "true"
    ? { ssl: { rejectUnauthorized: false } }
    : {};

  return { ...base, ...ssl, ...overrides };
}

// ─── Primary pool — app_user with RLS enforced ────────────────────────────────
const pool = new Pool({
  ...buildConnectionConfig(),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// ─── Auth pool — auth_user, bypasses RLS, used ONLY for login ─────────────────
// BUG FIX: authPool was inheriting host from DATABASE_URL (undefined in Docker),
// causing it to attempt localhost instead of the postgres container.
// Explicit user/password override the connectionString credentials in pg.
const authPool = new Pool({
  ...buildConnectionConfig({
    user:     process.env.AUTH_DB_USER     || "auth_user",
    password: process.env.AUTH_DB_PASSWORD || "auth_password",
  }),
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error",     (err) => logger.error("Pool error",      { error: err.message }));
authPool.on("error", (err) => logger.error("Auth pool error", { error: err.message }));

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(options = {}) {
  const delayMs = options.delayMs || 5000;
  let attempt = 0;

  while (true) {
    try {
      attempt += 1;
      const client = await pool.connect();
      client.release();
      logger.info("Database connected", { attempt });
      return;
    } catch (err) {
      logger.warn("Database connection failed, retrying", {
        error: err.message,
        attempt,
        delayMs,
      });
      await delay(delayMs);
    }
  }
}

// ─── Query Logging Wrapper ──────────────────────────────────────────────────
const originalQuery = pool.query.bind(pool);

pool.query = async (...args) => {
  logger.debug("DB Query", { query: args[0], params: args[1] });
  try {
    return await originalQuery(...args);
  } catch (err) {
    logger.error("DB Error", { error: err.message, query: args[0] });
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

// ─── Tenant-scoped transaction — set_config scoped to transaction ─────────────
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

function getPool() {
  return pool;
}

module.exports = {
  query,
  authQuery,
  withTenant,
  tenantQuery,
  tenantContext,
  pool,
  getPool,
  connectWithRetry,
};