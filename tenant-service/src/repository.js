const db = require("@saas/shared/utils/db");
const logger = require("@saas/shared/utils/logger");

const DEFAULT_FEATURES = {
  free: ["basic_upload", "basic_api"],
  pro: ["basic_upload", "basic_api", "analytics", "export"],
  enterprise: ["basic_upload", "basic_api", "analytics", "export", "ai_reports", "sso", "audit_logs"],
};

async function createTenant({ name, slug, plan = "free" }) {
  // Step 1: insert tenant without tenant context (it doesn't exist yet).
  // tenants table has no RLS so this is safe.
  logger.info("tenant-service.repository.insert_tenant", { name, slug, plan });
  const tenantResult = await db.query(
    `INSERT INTO tenants (name, slug, plan) VALUES ($1, $2, $3) RETURNING *`,
    [name, slug, plan]
  );
  const tenant = tenantResult.rows[0];

  // Step 2: seed features and subscription inside a tenant-scoped transaction.
  await db.withTenant(tenant.tenant_id, async (client) => {
    const features = DEFAULT_FEATURES[plan] || DEFAULT_FEATURES.free;
    for (const feature of features) {
      await client.query(
        `INSERT INTO tenant_features (tenant_id, feature, enabled) VALUES ($1, $2, true)`,
        [tenant.tenant_id, feature]
      );
    }
    logger.debug("tenant-service.repository.setting_tenant_context", { tenantId: tenant.tenant_id });
    await client.query(
      `INSERT INTO subscriptions (tenant_id, plan) VALUES ($1, $2)`,
      [tenant.tenant_id, plan]
    );
  });

  return tenant;
}

async function getAllTenants() {
  // BUG FIX #3: tenant_features has RLS. A LEFT JOIN against it without a
  // tenant context causes current_setting('app.current_tenant_id') to return ''
  // → NULLIF(...) → NULL → tenant_id = NULL is always false → every tenant
  // returns empty features []. Fetch features in a separate pass per tenant,
  // or bypass RLS for this admin-level read by querying tenants only and
  // joining features without the app_user restriction.
  //
  // Simplest safe fix: query tenants (no RLS) then aggregate features per
  // tenant using a subquery that doesn't cross the RLS boundary by using
  // a SECURITY DEFINER view, OR just exclude the features join here and
  // fetch features on-demand. For now we return tenants without features
  // from this bulk endpoint (features available via getTenantFeatures).
  const result = await db.query(
    `SELECT * FROM tenants
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC`
  );
  return result.rows;
}

async function getTenantById(tenantId) {
  // tenants has no RLS — plain query is fine.
  // BUG FIX: removed LEFT JOIN on tenant_features (RLS-protected) without
  // tenant context, which silently returned empty features. Features are
  // fetched separately via getTenantFeatures when needed.
  const result = await db.query(
    `SELECT * FROM tenants WHERE tenant_id = $1 AND deleted_at IS NULL`,
    [tenantId]
  );
  return result.rows[0] || null;
}

async function updateTenantPlan(tenantId, plan) {
  // Update the plan column (tenants has no RLS).
  const result = await db.query(
    `UPDATE tenants SET plan = $1 WHERE tenant_id = $2 RETURNING *`,
    [plan, tenantId]
  );
  if (!result.rows[0]) return null;

  // BUG FIX #4: DELETE + INSERT on tenant_features requires tenant context
  // because tenant_features has RLS with FORCE. Without withTenant(), the
  // DELETE silently deletes 0 rows and the INSERT throws an RLS WITH CHECK
  // violation (or inserts 0 rows), leaving stale features in place.
  await db.withTenant(tenantId, async (client) => {
    await client.query(
      `DELETE FROM tenant_features WHERE tenant_id = $1`,
      [tenantId]
    );
    const features = DEFAULT_FEATURES[plan] || DEFAULT_FEATURES.free;
    for (const feature of features) {
      await client.query(
        `INSERT INTO tenant_features (tenant_id, feature, enabled) VALUES ($1, $2, true)`,
        [tenantId, feature]
      );
    }
  });

  return result.rows[0];
}

async function getTenantFeatures(tenantId) {
  // Correctly uses tenantQuery — no change needed.
  const result = await db.tenantQuery(
    tenantId,
    `SELECT feature, enabled FROM tenant_features`,
    []
  );
  return result.rows;
}

async function hasFeature(tenantId, feature) {
  const result = await db.tenantQuery(
    tenantId,
    `SELECT 1 FROM tenant_features WHERE feature = $1 AND enabled = true`,
    [feature]
  );
  return result.rows.length > 0;
}

async function getTenantBySlug(slug) {
  const result = await db.query(
    `SELECT * FROM tenants WHERE slug = $1 AND deleted_at IS NULL`,
    [slug]
  );
  return result.rows[0] || null;
}

async function deleteTenant(tenantId) {
  const result = await db.query(
    `UPDATE tenants SET deleted_at = NOW() WHERE tenant_id = $1 RETURNING *`,
    [tenantId]
  );
  return result.rows[0] || null;
}

module.exports = {
  createTenant,
  getAllTenants,
  getTenantById,
  getTenantBySlug,
  updateTenantPlan,
  getTenantFeatures,
  hasFeature,
  deleteTenant,
};