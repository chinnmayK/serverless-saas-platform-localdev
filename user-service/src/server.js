require('./tracing');
const express = require("express");
const routes = require("./routes");
const logger = require("@saas/shared/utils/logger");
const requestLogger = require("@saas/shared/middleware/requestLogger");

const app = express();
const PORT = process.env.PORT || 3002;

const usage = require("@saas/shared/middleware/usageMiddleware");

app.use(express.json());
app.use(requestLogger);

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "user-service", uptime: process.uptime() });
});

// Both /auth/* and /users/* are handled in one router
app.use("/", routes);

// Global error handler
app.use((err, req, res, next) => {
  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    tenantId: req.tenantId || null,
  });
  res.status(500).json({ success: false, error: "Internal server error" });
});

// Catch unhandled promise rejections
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason: String(reason) });
});

// Standard Express app export
module.exports = app;

// Listen if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[user-service] Running on port ${PORT}`);
  });
}
