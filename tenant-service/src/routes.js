const express = require("express");
const router = express.Router();
const service = require("./service");
const response = require("@saas/shared/utils/response");
const auth = require("@saas/shared/middleware/authMiddleware");
const tenant = require("@saas/shared/middleware/tenantMiddleware");
const { requireRole } = require("@saas/shared/middleware/rbacMiddleware");
const { idempotencyMiddleware, usageMiddleware } = require("@saas/shared/middleware");

// POST /tenants — create a new tenant
router.post("/tenants", idempotencyMiddleware, async (req, res) => {
  try {
    const created = await service.createTenant(req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
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

// PATCH /tenants/:id/plan — upgrade/downgrade plan
router.patch("/tenants/:id/plan", auth, tenant, usageMiddleware, requireRole("admin"), async (req, res) => {
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

// DELETE /tenants/:id (admin only)
router.delete("/tenants/:id", auth, tenant, usageMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const removed = await service.removeTenant(req.params.id);
    return response.success(res, removed);
  } catch (err) {
    return response.notFound(res, err.message);
  }
});

module.exports = router;
