require('@saas/shared');
require('./tracing');
const cron = require("node-cron");
const { aggregateUsage } = require("./jobs/aggregateUsage");
const { generateInvoices } = require("./jobs/generateInvoices");
const { processUsage } = require("./jobs/processUsage");
const { connectWithRetry } = require("@saas/shared/utils/db");
const logger = require("@saas/shared/utils/logger");

async function start() {
  logger.info("worker-service.starting");
  await connectWithRetry({ delayMs: 5000 });

  // 🔥 STARTS BACKGROUND CONSUMER (NON-BLOCKING)
  processUsage().catch(err => {
    logger.error("worker-service.processUsage_failed", { error: err.message });
  });

  // Every hour — aggregate usage metrics
  cron.schedule("0 * * * *", async () => {
    try {
      await aggregateUsage();
    } catch (err) {
      logger.error("worker-service.aggregateUsage_failed", { error: err.message });
    }
  });

  // 1st of every month at 00:05 — generate invoices
  cron.schedule("5 0 1 * *", async () => {
    try {
      await generateInvoices();
    } catch (err) {
      logger.error("worker-service.generateInvoices_failed", { error: err.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    aggregateUsage().catch(err => {
      logger.error("worker-service.aggregateUsage_dev_run_failed", { error: err.message });
    });
  }

  logger.info("worker-service.started");
}

start().catch((err) => {
  logger.error("worker-service.start_failed", { error: err.message });
  process.exit(1);
});
