const express = require("express");
const router = express.Router();
const service = require("./service");
const response = require("@saas/shared/utils/response");
const auth = require("@saas/shared/middleware/authMiddleware");
const tenant = require("@saas/shared/middleware/tenantMiddleware");
const { requireRole } = require("@saas/shared/middleware/rbacMiddleware");
const { idempotencyMiddleware } = require("@saas/shared/middleware");

// POST /tenants — create a new tenant
router.post("/tenants", idempotencyMiddleware, async (req, res) => {
  try {
    const created = await service.createTenant(req.body);
    return response.created(res, created);
  } catch (err) {
    return response.error(res, err.message);
  }
});


// GET /tenants — list all tenants
router.get("/tenants", auth, async (req, res) => {
  try {
    const tenants = await service.listTenants();
    return response.success(res, tenants);
  } catch (err) {
    return response.error(res, err.message);
  }
});

// GET /tenants/:id — get specific tenant
router.get("/tenants/:id", auth, async (req, res) => {
  try {
    const t = await service.getTenant(req.params.id);
    return response.success(res, t);
  } catch (err) {
    return response.notFound(res, err.message);
  }
});

router.patch("/tenants/:id/plan", auth, tenant, requireRole("admin"), async (req, res) => {
  try {
    const updated = await service.upgradePlan(req.params.id, req.body.plan);
    return response.success(res, updated);
  } catch (err) {
    return response.error(res, err.message, 400);
  }
});

// GET /tenants/:id/features — list feature flags for tenant
router.get("/tenants/:id/features", auth, async (req, res) => {
  try {
    const features = await service.getFeatures(req.params.id);
    return response.success(res, features);
  } catch (err) {
    return response.error(res, err.message);
  }
});

router.delete("/tenants/:id", auth, tenant, requireRole("admin"), async (req, res) => {
  try {
    const removed = await service.removeTenant(req.params.id);
    return response.success(res, removed);
  } catch (err) {
    return response.notFound(res, err.message);
  }
});

const onboardingService = require('./onboarding');

// POST /tenants/onboard  — single-shot: tenant + admin user + free plan
router.post('/onboard', idempotencyMiddleware, async (req, res) => {
  const { tenantName, adminEmail, adminPassword, adminName } = req.body;

  if (!tenantName || !adminEmail || !adminPassword) {
    return res.status(400).json({ error: 'tenantName, adminEmail, adminPassword required' });
  }

  try {
    const result = await onboardingService.onboard({
      tenantName, adminEmail, adminPassword, adminName: adminName ?? adminEmail,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.code === '23505') {  // unique_violation
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: err.message });
  }
});

const db = require("@saas/shared/utils/db");

// GET /dashboard/activity — summary for tenant dashboard
router.get("/dashboard/activity", auth, tenant, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const limit = parseInt(req.query.limit) || 10;

    const result = await db.tenantQuery(
      tenantId,
      `SELECT id, endpoint, method, status_code, timestamp 
       FROM usage_logs 
       WHERE tenant_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [tenantId, limit]
    );

    return response.success(res, result.rows);
  } catch (err) {
    return response.error(res, err.message);
  }
});

module.exports = router;
