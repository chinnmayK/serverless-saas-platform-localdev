const response = require("../utils/response");

// Must be used AFTER authMiddleware
// Extracts tenantId from the JWT payload and attaches it to the request
module.exports = (req, res, next) => {
  if (!req.user || !req.user.tenantId) {
    return response.forbidden(res, "No tenant context found in token");
  }

  const db = require("../utils/db");
  db.tenantContext.run(req.user.tenantId, () => {
    req.tenantId = req.user.tenantId;
    req.userId = req.user.userId;
    req.role = req.user.role;
    next();
  });
};
