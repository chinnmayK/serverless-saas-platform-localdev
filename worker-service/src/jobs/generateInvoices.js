const db = require("@saas/shared/utils/db");
const logger = require("@saas/shared/utils/logger");

const PRICING = {
  free:       { base: 0,   included: 1000,   overagePer1k: 0 },
  pro:        { base: 49,  included: 10000,  overagePer1k: 0.5 },
  enterprise: { base: 299, included: 100000, overagePer1k: 0.1 },
};

// Runs on 1st of each month at midnight.
async function generateInvoices() {
  logger.info("generateInvoices job started");

  const tenants = await db.query(`SELECT tenant_id, plan FROM tenants WHERE status = 'active'`);

  for (const tenant of tenants.rows) {
    const pricing = PRICING[tenant.plan] || PRICING.free;

    const usageResult = await db.tenantQuery(
      tenant.tenant_id,
      `SELECT COUNT(*) AS total FROM usage_logs
       WHERE tenant_id = $1
         AND timestamp >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
         AND timestamp <  DATE_TRUNC('month', NOW())`,
      [tenant.tenant_id]
    );

    const total = parseInt(usageResult.rows[0].total, 10);
    const overage = Math.max(0, total - pricing.included);
    const charge = pricing.base + (overage / 1000) * pricing.overagePer1k;

    logger.audit("invoice.generated", {
      tenantId: tenant.tenant_id,
      plan: tenant.plan,
      usageCalls: total,
      chargeUSD: charge.toFixed(2),
    });
  }

  logger.info("generateInvoices job complete", { processed: tenants.rows.length });
}

module.exports = { generateInvoices };
