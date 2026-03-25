const db = require('../utils/db');
const logger = require('../utils/logger');

module.exports = (req, res, next) => {
  // 🔥 DO NOT BLOCK REQUEST
  setImmediate(async () => {
    try {
      if (!req.user?.tenantId) return;

      // ✅ CRITICAL FIX: Use tenantQuery() directly to explicitly set RLS context
      // db.query() relies on AsyncLocalStorage which is lost in setImmediate()
      // tenantQuery() explicitly sets the app.current_tenant_id before inserting
      await db.tenantQuery(
        req.user.tenantId,
        `INSERT INTO usage_logs (tenant_id, endpoint, method)
         VALUES ($1, $2, $3)`,
        [
          req.user.tenantId,
          req.originalUrl,
          req.method
        ]
      );

      logger.info('Usage logged');
    } catch (err) {
      logger.error('Usage log failed', { error: err.message });
    }
  });

  next(); // 🔥 ALWAYS continue immediately
};