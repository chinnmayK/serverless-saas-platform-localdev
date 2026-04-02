require('./tracing');
const cron = require("node-cron");
const { aggregateUsage }   = require("./jobs/aggregateUsage");
const { generateInvoices } = require("./jobs/generateInvoices");
const { processUsage }      = require("./jobs/processUsage");
const logger = require("@saas/shared/utils/logger");

logger.info("Worker service started");

// 🔥 STARTS BACKGROUND CONSUMER (NON-BLOCKING)
processUsage().catch(err => {
  logger.error("Usage consumer failed", { error: err.message });
});

// Every hour — aggregate usage metrics
cron.schedule("0 * * * *", async () => {
  try { await aggregateUsage(); }
  catch (err) { logger.error("aggregateUsage failed", { error: err.message }); }
});

// 1st of every month at 00:05 — generate invoices
cron.schedule("5 0 1 * *", async () => {
  try { await generateInvoices(); }
  catch (err) { logger.error("generateInvoices failed", { error: err.message }); }
});

// Immediately on boot in dev so you can see it working
if (process.env.NODE_ENV !== "production") {
  aggregateUsage().catch(console.error);
}
