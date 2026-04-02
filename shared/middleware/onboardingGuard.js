const { getPool } = require('../utils/db');

/**
 * Blocks access if tenant has not completed onboarding.
 * Attach AFTER authMiddleware on protected routes.
 */
async function onboardingGuard(req, res, next) {
  if (!req.tenantId) return next();
  
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT onboarding_completed FROM tenants WHERE tenant_id = $1',
      [req.tenantId]
    );
    
    if (rows[0] && !rows[0].onboarding_completed) {
      return res.status(403).json({
        error: 'Onboarding not complete',
        onboarding_url: '/onboarding',
      });
    }
    next();
  } catch (err) {
    console.error('[onboardingGuard] Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error during onboarding check' });
  }
}

module.exports = { onboardingGuard };
