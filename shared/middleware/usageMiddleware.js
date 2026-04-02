const { getRedisClient } = require('../utils/redis');
const logger = require('../utils/logger');

let tenantRequestsTotal;
try {
  tenantRequestsTotal = require('../../api-gateway/src/metrics').tenantRequestsTotal;
} catch (e) {
  // Fallback
  tenantRequestsTotal = { inc: () => {} };
}

module.exports = async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) return next();

    // ✅ Prometheus Metric (In-memory, fast)
    if (tenantRequestsTotal) {
      tenantRequestsTotal.inc({ tenant_id: tenantId });
    }

    // 🔥 OFF-LOAD TO REDIS (ULTRA-LIGHTWEIGHT)
    const usageData = {
      tenantId,
      userId: req.user?.user_id || 'anon',
      endpoint: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    };

    const redis = await getRedisClient();
    // Non-blocking push
    redis.lPush('usage:queue', JSON.stringify(usageData)).catch(err => {
      logger.error('Failed to push usage to Redis', { error: err.message });
    });

  } catch (err) {
    // logger.error('Usage middleware error', { error: err.message });
  }

  next(); // 🔥 ALWAYS continue immediately
};