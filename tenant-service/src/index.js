require('@saas/shared');
require('./tracing');
const express = require("express");
const tenantRoutes = require("./routes");
const logger = require("@saas/shared/utils/logger");
const requestLogger = require("@saas/shared/middleware/requestLogger");
const { connectWithRetry } = require("@saas/shared/utils/db");

const app = express();
const PORT = process.env.PORT || 3000;

const usage = require("@saas/shared/middleware/usageMiddleware");

app.use(express.json());
app.use(requestLogger);

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "tenant-service", uptime: process.uptime() });
});

app.use("/", tenantRoutes);

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

async function start() {
  await connectWithRetry({ delayMs: 5000 });
  app.listen(PORT, () => {
    logger.info('tenant-service.started', { port: PORT });
  });
}

start().catch((err) => {
  logger.error("tenant-service.start_failed", { error: err.message });
  process.exit(1);
});
