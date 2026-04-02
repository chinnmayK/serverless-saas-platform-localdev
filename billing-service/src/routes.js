const express = require('express');
const router = express.Router();
const { authMiddleware } = require('@saas/shared/middleware');
const billing = require('./billing');
const { recordUsage, getUsageEvents } = require("./usageMeter");
const response = require("@saas/shared/utils/response");
const tenantCtx = require("@saas/shared/middleware/tenantMiddleware");
const serviceAuth = require("@saas/shared/middleware/serviceAuthMiddleware");
const { idempotencyMiddleware } = require("@saas/shared/middleware");
const db = require("@saas/shared/utils/db");

// NOT exposed through the gateway to end users
router.post("/internal/usage", serviceAuth, idempotencyMiddleware, async (req, res) => {
  try {
    const { tenantId, userId, apiName, method } = req.body;
    if (!tenantId) return response.badRequest(res, "tenantId required");
    await recordUsage({ tenantId, userId, apiName, method });
    return response.success(res, { recorded: true });
  } catch (err) {
    return response.error(res, err.message);
  }
});

// Stripe Webhook — raw body required (NO AUTH)
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const result = await billing.handleWebhook(
        req.body,
        req.headers['stripe-signature']
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// All billing routes require auth + tenant context
router.use(authMiddleware, tenantCtx);

// GET /billing/invoice — generate current month invoice
router.get("/invoice", async (req, res) => {
  try {
    const invoice = await generateInvoice(req.tenantId);
    return response.success(res, invoice);
  } catch (err) {
    return response.error(res, err.message);
  }
});

// GET /billing/subscription — view subscription details
router.get("/subscription", async (req, res) => {
  try {
    const sub = await getSubscription(req.tenantId);
    if (!sub) return response.notFound(res, "Subscription not found");
    return response.success(res, sub);
  } catch (err) {
    return response.error(res, err.message);
  }
});

// GET /billing/usage — simple usage summary
router.get('/usage', async (req, res) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    
    if (!tenantId) {
      return response.badRequest(res, "Tenant context missing");
    }

    const result = await db.tenantQuery(
      tenantId,
      `SELECT endpoint, COUNT(*) as count
       FROM usage_logs
       WHERE tenant_id = $1
       GROUP BY endpoint`,
      [tenantId]
    );

    const total = result.rows.reduce((sum, r) => sum + parseInt(r.count), 0);

    return response.success(res, {
      total,
      byEndpoint: result.rows
    });
  } catch (err) {
    return response.error(res, err.message);
  }
});


// GET /billing/usage/events — raw usage events
router.get("/usage/events", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const events = await getUsageEvents(req.tenantId, limit, offset);
    return response.success(res, events);
  } catch (err) {
    return response.error(res, err.message);
  }
});

// POST /billing/usage — record a usage event (called by other services)
router.post("/usage", idempotencyMiddleware, async (req, res) => {
  try {
    const { apiName, method } = req.body;
    await recordUsage({
      tenantId: req.tenantId,
      userId: req.userId,
      apiName,
      method,
    });
    return response.success(res, { recorded: true });
  } catch (err) {
    return response.error(res, err.message);
  }
});


// Create Checkout Session — authenticated tenant admin
router.post('/create-checkout', authMiddleware, async (req, res) => {
  try {
    const url = await billing.createCheckoutSession(
      req.tenantId,
      req.user.email,
      req.user.name
    );
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer Portal — manage/cancel subscription
router.post('/portal', authMiddleware, async (req, res) => {
  try {
    const url = await billing.createPortalSession(req.tenantId);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /billing/dashboard/usage
router.get('/dashboard/usage', async (req, res) => {
  const pool = db.getPool();
  const tenantId = req.tenantId;

  const [total, byEndpoint, last24h] = await Promise.all([
    pool.query(
      'SELECT COUNT(*) AS total_requests FROM usage_logs WHERE tenant_id = $1',
      [tenantId]
    ),
    pool.query(
      `SELECT endpoint, COUNT(*) AS count
         FROM usage_logs
        WHERE tenant_id = $1
        GROUP BY endpoint
        ORDER BY count DESC
        LIMIT 20`,
      [tenantId]
    ),
    pool.query(
      `SELECT DATE_TRUNC('hour', timestamp) AS hour, COUNT(*) AS count
         FROM usage_logs
        WHERE tenant_id = $1
          AND timestamp >= NOW() - INTERVAL '24 hours'
        GROUP BY hour
        ORDER BY hour`,
      [tenantId]
    ),
  ]);

  res.json({
    total_requests: parseInt(total.rows[0].total_requests, 10),
    by_endpoint: byEndpoint.rows,
    last_24_h: last24h.rows,
  });
});

// GET /billing/dashboard/billing
router.get('/dashboard/billing', async (req, res) => {
  const pool = db.getPool();
  const { rows } = await pool.query(
    `SELECT t.plan, t.plan_status, t.stripe_subscription_id,
            p.quota_requests_per_min AS quota,
            p.price_usd,
            (
              SELECT COUNT(*) FROM usage_logs
               WHERE tenant_id = t.tenant_id
                 AND timestamp >= DATE_TRUNC('month', NOW())
            ) AS used_this_month
       FROM tenants t
       JOIN plans p ON p.id = t.plan
      WHERE t.tenant_id = $1`,
    [req.tenantId]
  );

  if (!rows.length) return res.status(404).json({ error: 'Tenant not found' });
  const row = rows[0];

  res.json({
    plan:         row.plan,
    plan_status:  row.plan_status,
    price_usd:    row.price_usd,
    quota:        row.quota,
    used:         parseInt(row.used_this_month, 10),
    remaining:    Math.max(0, row.quota - parseInt(row.used_this_month, 10)),
    has_subscription: !!row.stripe_subscription_id,
  });
});

module.exports = router;
