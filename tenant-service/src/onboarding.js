const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const { getPool }  = require('@saas/shared/utils/db');
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
    const slug = tenantName.toLowerCase().replace(/\s+/g, '-');
    
    await client.query(
      `INSERT INTO tenants (tenant_id, name, slug, plan, plan_status, onboarding_completed)
       VALUES ($1, $2, $3, $4, 'active', FALSE)`,
      [tenantId, tenantName, slug, DEFAULT_PLAN]
    );

    // Set session context for RLS
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

    // 5. Issue JWT
    const token = jwt.sign(
      { userId, tenantId, email: adminEmail, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      tenantId:   tenantId,
      userId:     userId,
      plan:        DEFAULT_PLAN,
      token,
      onboardingCompleted: true,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { onboard };
