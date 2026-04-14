const db = require("@saas/shared/utils/db");
const logger = require("@saas/shared/utils/logger");

// Runs every hour.
// Reads raw usage events, writes aggregated summary per tenant.
// In production this would write to a summary table or push to an analytics store.
async function aggregateUsage() {
  logger.info("aggregateUsage job started");

  // 1. Fetch all active tenants (no RLS on tenants table)
  const tenants = await db.query("SELECT tenant_id FROM tenants WHERE status = 'active'");
  let totalProcessed = 0;

  for (const tenant of tenants.rows) {
    const tenantId = tenant.tenant_id;

    // 2. Aggregate usage for this specific tenant using tenantQuery to set RLS context
    const result = await db.tenantQuery(
      tenantId,
      `SELECT
        tenant_id,
        api_name,
        DATE_TRUNC('hour', created_at) AS hour_bucket,
        COUNT(*) AS call_count
      FROM usage
      WHERE created_at > NOW() - INTERVAL '2 hours'
      GROUP BY tenant_id, api_name, hour_bucket`,
      []
    );

    if (result.rows.length > 0) {
      // In a real app, we would save these results to a 'usage_aggregates' table
      logger.info("aggregated usage for tenant", { 
        tenantId, 
        buckets: result.rows.length 
      });
      totalProcessed += result.rows.length;
    }
  }

  logger.info("aggregateUsage job complete", { totalBuckets: totalProcessed });
  return totalProcessed;
}


module.exports = { aggregateUsage };
