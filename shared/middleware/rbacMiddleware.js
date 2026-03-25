const response = require("../utils/response");

// Usage: router.delete("/:id", auth, tenantCtx, requireRole("admin"), handler)
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.role || !allowedRoles.includes(req.role)) {
    return response.forbidden(res, `Role '${req.role}' cannot perform this action`);
  }
  next();
};

module.exports = { requireRole };
