const { getRedisClient } = require('@saas/shared/utils/redis');
const db = require('@saas/shared/utils/db');
const logger = require('@saas/shared/utils/logger');

async function processUsage() {
  const redis = await getRedisClient();
  logger.info("processUsage starting Redis consumer loop...");

  while (true) {
    try {
      // BRPOP blocks until an item is available. Timeout 0 means wait forever.
      const result = await redis.brPop('usage:queue', 0);
      
      if (result) {
        const { element } = result;
        const data = JSON.parse(element);

        // ✅ CRITICAL FIX: Use tenantQuery() directly to explicitly set RLS context
        // In the worker, we don't have a global req/tenant context in AsyncLocalStorage,
        // so tenantQuery ensures the app.current_tenant_id is set before INSERT.
        await db.tenantQuery(
          data.tenantId,
          `INSERT INTO usage_logs (tenant_id, endpoint, method, timestamp)
           VALUES ($1, $2, $3, $4)`,
          [
            data.tenantId,
            data.endpoint,
            data.method,
            data.timestamp
          ]
        );
      }
    } catch (err) {
      logger.error('Error processing usage log from Redis', { error: err.message });
      // Short sleep to prevent tight error loops
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = { processUsage };
