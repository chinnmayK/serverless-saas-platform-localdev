const db = require("@saas/shared/utils/db");
const logger = require("@saas/shared/utils/logger");

// Runs every hour.
// Reads raw usage events, writes aggregated summary per tenant.
// In production this would write to a summary table or push to an analytics store.
async function aggregateUsage() {
  logger.info("aggregateUsage job started");

  const result = await db.query(`
    SELECT
      tenant_id,
      api_name,
      DATE_TRUNC('hour', created_at) AS hour_bucket,
      COUNT(*) AS call_count
    FROM usage
    WHERE created_at > NOW() - INTERVAL '2 hours'
    GROUP BY tenant_id, api_name, hour_bucket
  `);

  logger.info("aggregateUsage job complete", { rows: result.rowCount });
  return result.rows;
}

module.exports = { aggregateUsage };
