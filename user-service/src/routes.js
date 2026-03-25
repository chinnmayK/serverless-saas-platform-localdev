const express = require("express");
const router = express.Router();
const service = require("./service");
const response = require("@saas/shared/utils/response");
const auth = require("@saas/shared/middleware/authMiddleware");
const tenantCtx = require("@saas/shared/middleware/tenantMiddleware");
const { requireRole } = require("@saas/shared/middleware/rbacMiddleware");
const trackUsage = require("@saas/shared/middleware/usageMiddleware");
const { idempotencyMiddleware } = require("@saas/shared/middleware");

// ─── Auth routes (public) ────────────────────────────────────────────────────

// POST /auth/register — register a new user under a tenant
router.post("/auth/register", idempotencyMiddleware, async (req, res) => {
  try {
    const user = await service.register(req.body);
    return response.created(res, user);
  } catch (err) {
    return response.error(res, err.message, 400);
  }
});

// POST /auth/login — login and get JWT
router.post("/auth/login", async (req, res) => {
  try {
    const result = await service.login(req.body);
    return response.success(res, result);
  } catch (err) {
    // Explicitly handle invalid credentials with 401
    if (err.message === "Invalid email or password") {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password"
      });
    }
    return response.error(res, err.message, 400);
  }
});

// ─── User routes (protected) ─────────────────────────────────────────────────

// GET /users — list all users in the caller's tenant
router.get("/users", auth, tenantCtx, trackUsage, async (req, res) => {
  try {
    const users = await service.listUsers(req.tenantId);
    return response.success(res, users);
  } catch (err) {
    return response.error(res, err.message);
  }
});

// GET /users/:id — get a single user (must be same tenant)
router.get("/users/:id", auth, tenantCtx, trackUsage, async (req, res) => {
  try {
    const user = await service.getUser(req.params.id, req.tenantId);
    return response.success(res, user);
  } catch (err) {
    return response.notFound(res, err.message);
  }
});

// DELETE /users/:id — remove a user from tenant (admin only)
router.delete("/users/:id", auth, tenantCtx, trackUsage, requireRole("admin"), async (req, res) => {
  try {
    const removed = await service.removeUser(req.params.id, req.tenantId);
    return response.success(res, removed);
  } catch (err) {
    return response.notFound(res, err.message);
  }
});

module.exports = router;
