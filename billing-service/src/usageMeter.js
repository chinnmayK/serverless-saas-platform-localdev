const db = require("@saas/shared/utils/db");

/**
 * Record a single API call for a tenant.
 * Called internally by other services (or via HTTP from the gateway).
 */
async function recordUsage({ tenantId, userId, apiName, method }) {
  await db.tenantQuery(
    tenantId,
    `INSERT INTO usage_logs (tenant_id, user_id, endpoint, method)
     VALUES ($1, $2, $3, $4)`,
    [tenantId, userId || null, apiName, method || "UNKNOWN"]
  );
}

/**
 * Aggregate usage for a tenant within a time window.
 * Returns per-API breakdown and total count.
 */
async function getUsageSummary(tenantId, from, to) {
  const result = await db.tenantQuery(
    tenantId,
    `SELECT 
       endpoint, 
       method, 
       COUNT(*) AS "callCount", 
       MIN(timestamp) AS "firstCall", 
       MAX(timestamp) AS "lastCall"
     FROM usage_logs 
     WHERE timestamp BETWEEN $1 AND $2 
     GROUP BY endpoint, method 
     ORDER BY "callCount" DESC`,
    [from, to]
  );

  const total = result.rows.reduce((sum, r) => sum + parseInt(r.callCount, 10), 0);

  return { tenantId, from, to, total, breakdown: result.rows };
}

/**
 * Raw usage events for a tenant (paginated).
 */
async function getUsageEvents(tenantId, limit = 100, offset = 0) {
  const result = await db.tenantQuery(
    tenantId,
    `SELECT * FROM usage_logs
     ORDER BY timestamp DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

module.exports = { recordUsage, getUsageSummary, getUsageEvents };

