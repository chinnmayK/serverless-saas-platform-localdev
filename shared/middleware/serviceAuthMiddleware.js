const response = require("../utils/response");

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || "internal_dev_token";

// Applied to routes that should only be callable by other services,
// not by end users through the gateway.
module.exports = (req, res, next) => {
  const token = req.headers["x-internal-token"];
  if (!token || token !== INTERNAL_TOKEN) {
    return response.forbidden(res, "Internal service token required");
  }
  next();
};
