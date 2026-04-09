require('@saas/shared');
require('./tracing');
const express = require("express");
const routes = require("./routes");
const { initBucket } = require("./storage");
const logger = require("@saas/shared/utils/logger");
const requestLogger = require("@saas/shared/middleware/requestLogger");

const app = express();
const PORT = process.env.PORT || 3000;

const usage = require("@saas/shared/middleware/usageMiddleware");

app.use(express.json());
app.use(requestLogger);

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "file-service", uptime: process.uptime() });
});

app.use("/files", routes);

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

const { connectWithRetry } = require("@saas/shared/utils/db");

async function start() {
  await connectWithRetry({ delayMs: 5000 });

  // Wait for MinIO to be ready, then ensure bucket exists
  let retries = 10;
  while (retries--) {
    try {
      await initBucket();
      break;
    } catch (err) {
      logger.warn('file-service.minio_not_ready', { retriesLeft: retries });
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  app.listen(PORT, () => {
    logger.info('file-service.started', { port: PORT });
  });
}

start().catch((err) => {
  logger.error("file-service.start_failed", { error: err.message });
  process.exit(1);
});
