const db = require("@saas/shared/utils/db");
const { getUsageSummary } = require("./usageMeter");

// Simulated pricing per API call per plan
const PRICING = {
  free: { pricePerCall: 0, includedCalls: 1000, overagePer1k: 0 },
  pro: { pricePerCall: 0, includedCalls: 10000, overagePer1k: 0.5 },
  enterprise: { pricePerCall: 0, includedCalls: 100000, overagePer1k: 0.1 },
};

const BASE_PRICE = { free: 0, pro: 49, enterprise: 299 };

/**
 * Generate a simulated invoice for a tenant for the current month.
 */
async function generateInvoice(tenantId) {
  // Get tenant plan
  const tenantResult = await db.query(
    `SELECT plan FROM tenants WHERE tenant_id = $1`,
    [tenantId]
  );
  if (!tenantResult.rows[0]) throw new Error("Tenant not found");

  const plan = tenantResult.rows[0].plan;

  // Date range: current month
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to = now.toISOString();

  const usage = await getUsageSummary(tenantId, from, to);

  const pricing = PRICING[plan] || PRICING.free;
  const basePrice = BASE_PRICE[plan] || 0;

  const overageCalls = Math.max(0, usage.total - pricing.includedCalls);
  const overageCharge = ((overageCalls / 1000) * pricing.overagePer1k).toFixed(2);
  const totalAmount = (basePrice + parseFloat(overageCharge)).toFixed(2);

  return {
    tenantId,
    plan,
    period: { from, to },
    usage: {
      total: usage.total,
      included: pricing.includedCalls,
      overage: overageCalls,
    },
    charges: {
      base: basePrice,
      overage: parseFloat(overageCharge),
      total: parseFloat(totalAmount),
      currency: "USD",
    },
    breakdown: usage.breakdown,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Get subscription info for a tenant.
 */
async function getSubscription(tenantId) {
  const result = await db.tenantQuery(
    tenantId,
    `SELECT s.*, t.name AS tenant_name, t.plan
     FROM subscriptions s
     JOIN tenants t ON s.tenant_id = t.tenant_id`,
    []
  );
  return result.rows[0] || null;
}

module.exports = { generateInvoice, getSubscription };
