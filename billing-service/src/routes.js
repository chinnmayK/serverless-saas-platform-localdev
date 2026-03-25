const express = require("express");
const router = express.Router();
const { generateInvoice, getSubscription } = require("./billing");
const { recordUsage, getUsageSummary, getUsageEvents } = require("./usageMeter");
const response = require("@saas/shared/utils/response");
const auth = require("@saas/shared/middleware/authMiddleware");
const tenantCtx = require("@saas/shared/middleware/tenantMiddleware");
const serviceAuth = require("@saas/shared/middleware/serviceAuthMiddleware");
const { idempotencyMiddleware } = require("@saas/shared/middleware");
const db = require("@saas/shared/utils/db");

// Internal route — called by other services to record usage
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

// All billing routes require auth + tenant context
router.use(auth, tenantCtx);

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
    const tenantId = req.user.tenantId;

    const result = await db.query(
      `SELECT endpoint, COUNT(*) as count
       FROM usage_logs
       WHERE tenant_id = $1
       GROUP BY endpoint`,
      [tenantId]
    );

    const total = result.rows.reduce((sum, r) => sum + parseInt(r.count), 0);

    return res.json({
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


module.exports = router;
