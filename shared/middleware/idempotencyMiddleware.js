const db = require('../utils/db');
const logger = require('../utils/logger');

module.exports = async (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next();
  }

  const key = req.headers['idempotency-key'];
  if (!key) return next();

  logger.info('Idempotency Check', { key });

  try {
    const existing = await db.query(
      `SELECT response, status_code 
       FROM idempotency_keys 
       WHERE idempotency_key = $1 
       AND created_at > NOW() - INTERVAL '24 hours'`,
      [key]
    );

    if (existing.rows.length > 0) {
      logger.info('Idempotency HIT', { key });
      return res
        .status(existing.rows[0].status_code)
        .json(existing.rows[0].response);
    }

    logger.info('Idempotency MISS', { key });

    const originalJson = res.json;

    res.json = function (data) {
      // 🔥 DO NOT BLOCK RESPONSE
      const tenantId = req.user?.tenantId;
      setImmediate(async () => {
        try {
          // ✅ Use tenantQuery if authenticated (has tenant context)
          // Otherwise use query() for public routes (no tenant isolation required)
          if (tenantId) {
            await db.tenantQuery(
              tenantId,
              `INSERT INTO idempotency_keys (idempotency_key, response, status_code)
               VALUES ($1, $2, $3)
               ON CONFLICT DO NOTHING`,
              [key, JSON.stringify(data), res.statusCode || 200]
            );
          } else {
            // Public route - no tenant context, use plain query
            await db.query(
              `INSERT INTO idempotency_keys (idempotency_key, response, status_code)
               VALUES ($1, $2, $3)
               ON CONFLICT DO NOTHING`,
              [key, JSON.stringify(data), res.statusCode || 200]
            );
          }
        } catch (err) {
          logger.error('Idempotency save failed', { error: err.message });
        }
      });

      return originalJson.call(this, data);
    };

    next();
  } catch (err) {
    logger.error('Idempotency error', { error: err.message, key });
    next();
  }
};
