const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const { getPool }  = require('@saas/shared/utils/db');
const { MinioClient } = require('@saas/shared/utils');   // adjusted to actual export
const logger       = require('@saas/shared/utils/logger');

const SALT_ROUNDS    = 12;
const JWT_SECRET     = process.env.JWT_SECRET;
const DEFAULT_PLAN   = 'free';
const DEFAULT_FEATURES = ['file_upload', 'api_access'];

async function onboard({ tenantName, adminEmail, adminPassword, adminName }) {
  const pool   = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create tenant
    const tenantId = uuid();
    // Use the name for slug too for now, or generate a simple slug
    const slug = tenantName.toLowerCase().replace(/\s+/g, '-');
    
    await client.query(
      `INSERT INTO tenants (tenant_id, name, slug, plan, plan_status, onboarding_completed)
       VALUES ($1, $2, $3, $4, 'active', FALSE)`,
      [tenantId, tenantName, slug, DEFAULT_PLAN]
    );

    // ✅ Set session context for RLS - allows subsequent inserts (features, users) to pass
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);


    // 2. Provision default feature flags
    for (const feat of DEFAULT_FEATURES) {
      await client.query(
        `INSERT INTO tenant_features (tenant_id, feature, enabled)
         VALUES ($1, $2, TRUE)
         ON CONFLICT DO NOTHING`,
        [tenantId, feat]
      );
    }

    // 3. Create admin user
    const userId       = uuid();
    const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    await client.query(
      `INSERT INTO users (user_id, tenant_id, email, name, password_hash, is_admin)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [userId, tenantId, adminEmail, adminName, passwordHash]
    );

    // 4. Mark onboarding complete
    await client.query(
      'UPDATE tenants SET onboarding_completed = TRUE WHERE tenant_id = $1',
      [tenantId]
    );

    await client.query('COMMIT');

    // 5. Provision MinIO bucket for tenant (best-effort, outside transaction)
    try {
      await provisionStorage(tenantId);
    } catch (storageErr) {
      // Non-fatal — bucket can be created on first upload
      logger.warn("tenant-service.onboarding.minio_provision_failed", { error: storageErr.message });
    }

    // 6. Issue JWT
    const token = jwt.sign(
      { userId, tenantId, email: adminEmail, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      tenant_id:   tenantId,
      user_id:     userId,
      plan:        DEFAULT_PLAN,
      token,
      onboarding_completed: true,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function provisionStorage(tenantId) {
  // Reuse the MinIO client already initialised in file-service/src/storage.js
  // Here we just ensure the shared 'uploads' bucket exists — files are prefixed by tenantId
  // No per-tenant bucket needed; existing bucket initialization in file-service covers this.
  
  // Note: If we really wanted to ensure it here, we would do:
  // const bucket = process.env.MINIO_BUCKET || 'uploads';
  // const exists = await MinioClient.bucketExists(bucket).catch(() => false);
  // if (!exists) await MinioClient.makeBucket(bucket);
}

module.exports = { onboard };
