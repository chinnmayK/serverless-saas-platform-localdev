const db = require("@saas/shared/utils/db");
const logger = require("@saas/shared/utils/logger");

const DEFAULT_FEATURES = {
  free: ["basic_upload", "basic_api"],
  pro: ["basic_upload", "basic_api", "analytics", "export"],
  enterprise: ["basic_upload", "basic_api", "analytics", "export", "ai_reports", "sso", "audit_logs"],
};

async function createTenant({ name, slug, plan = "free" }) {
  // Step 1: insert tenant without tenant context (it doesn't exist yet)
  logger.info("tenant-service.repository.insert_tenant", { name, slug, plan });
  const tenantResult = await db.query(
    `INSERT INTO tenants (name, slug, plan) VALUES ($1, $2, $3) RETURNING *`,
    [name, slug, plan]
  );
  const tenant = tenantResult.rows[0];

  // Step 2: seed features and subscription INSIDE tenant context transaction
  await db.withTenant(tenant.tenant_id, async (client) => {
    // Seed default feature flags for this plan
    const features = DEFAULT_FEATURES[plan] || DEFAULT_FEATURES.free;
    for (const feature of features) {
      await client.query(
        `INSERT INTO tenant_features (tenant_id, feature, enabled) VALUES ($1, $2, true)`,
        [tenant.tenant_id, feature]
      );
    }

    // Create default subscription
    logger.debug("tenant-service.repository.setting_tenant_context", { tenantId: tenant.tenant_id });
    await client.query(
      `INSERT INTO subscriptions (tenant_id, plan) VALUES ($1, $2)`,
      [tenant.tenant_id, plan]
    );
  });

  return tenant;
}

async function getAllTenants() {
  const result = await db.query(
    `SELECT t.*, 
       COALESCE(json_agg(tf.feature) FILTER (WHERE tf.feature IS NOT NULL), '[]') AS features
     FROM tenants t
     LEFT JOIN tenant_features tf ON t.tenant_id = tf.tenant_id AND tf.enabled = true
     WHERE t.deleted_at IS NULL
     GROUP BY t.tenant_id
     ORDER BY t.created_at DESC`
  );
  return result.rows;
}

async function getTenantById(tenantId) {
  const result = await db.query(
    `SELECT t.*, 
       COALESCE(json_agg(tf.feature) FILTER (WHERE tf.feature IS NOT NULL), '[]') AS features
     FROM tenants t
     LEFT JOIN tenant_features tf ON t.tenant_id = tf.tenant_id AND tf.enabled = true
     WHERE t.tenant_id = $1 AND t.deleted_at IS NULL
     GROUP BY t.tenant_id`,
    [tenantId]
  );
  return result.rows[0] || null;
}

async function updateTenantPlan(tenantId, plan) {
  // Update plan
  const result = await db.query(
    `UPDATE tenants SET plan = $1 WHERE tenant_id = $2 RETURNING *`,
    [plan, tenantId]
  );
  if (!result.rows[0]) return null;

  // Reset features for new plan
  await db.query(`DELETE FROM tenant_features WHERE tenant_id = $1`, [tenantId]);
  const features = DEFAULT_FEATURES[plan] || DEFAULT_FEATURES.free;
  for (const feature of features) {
    await db.query(
      `INSERT INTO tenant_features (tenant_id, feature, enabled) VALUES ($1, $2, true)`,
      [tenantId, feature]
    );
  }

  return result.rows[0];
}

async function getTenantFeatures(tenantId) {
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
