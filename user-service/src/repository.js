const db = require("@saas/shared/utils/db");

// ─── Used at REGISTRATION — runs as app_user, RLS applies ────────────────────
async function createUser({ tenantId, email, passwordHash, role = "member" }) {
  // withTenant sets the RLS context so INSERT is allowed
  return db.withTenant(tenantId, async (client) => {
    const result = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, tenant_id, email, role, created_at`,
      [tenantId, email, passwordHash, role]
    );
    return result.rows[0];
  });
}

// ─── Used at LOGIN ONLY — runs as auth_user, bypasses RLS ────────────────────
// This is the ONLY place authQuery is used in the entire codebase.
// auth_user only has SELECT on (email, password_hash, role, tenant_id, user_id).
async function findUserByEmailForAuth(email) {
  const result = await db.authQuery(
    `SELECT
       u.user_id,
       u.tenant_id,
       u.email,
       u.password_hash,
       u.role,
       t.plan,
       t.status AS tenant_status
     FROM users u
     JOIN tenants t ON u.tenant_id = t.tenant_id
     WHERE u.email = $1`,
    [email]
  );
  return result.rows[0] || null;
}

// ─── All queries below run as app_user with RLS — tenant_id auto-filtered ─────

async function getUsersByTenant(tenantId) {
  const result = await db.tenantQuery(
    tenantId,
    `SELECT user_id, tenant_id, email, role, created_at
     FROM users
     ORDER BY created_at DESC`,
    []
  );
  return result.rows;
}

async function getUserById(userId, tenantId) {
  const logger = require("@saas/shared/utils/logger");
  logger.info("repository.getUserById", { userId, tenantId });
  const result = await db.tenantQuery(
    tenantId,
    `SELECT user_id, tenant_id, email, role, created_at
     FROM users
     WHERE user_id = $1 AND tenant_id = $2`,
    [userId, tenantId]
  );
  return result.rows[0] || null;
}

async function deleteUser(userId, tenantId) {
  const result = await db.withTenant(tenantId, async (client) => {
    return client.query(
      `DELETE FROM users 
       WHERE user_id = $1 AND tenant_id = $2 
       RETURNING user_id, email, role`,
      [userId, tenantId]
    );
  });
  return result.rows[0] || null;
}

module.exports = {
  createUser,
  findUserByEmailForAuth,   // ← renamed to make the special nature obvious
  getUsersByTenant,
  getUserById,
  deleteUser,
};
