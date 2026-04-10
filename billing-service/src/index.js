require('@saas/shared');
require('./tracing');
const express = require("express");
const routes = require("./routes");
const { connectWithRetry } = require("@saas/shared/utils/db");

const app = express();
const PORT = process.env.PORT || 3000;

const usage = require("@saas/shared/middleware/usageMiddleware");
const logger = require("@saas/shared/utils/logger");

// CRITICAL: webhook must be before json() middleware
app.use("/billing", routes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "billing-service", uptime: process.uptime() });
});

app.use(express.json());

(async () => {
  try {
    await connectWithRetry({ delayMs: 5000 });
    
    app.listen(PORT, () => {
      logger.info('billing-service.started', { port: PORT });
      console.log(`🚀 Service running on port ${PORT}`);
    });
  } catch (err) {
    logger.error("billing-service.start_failed", { error: err.message });
    process.exit(1);
  }
})();
