require('@saas/shared');
const cluster = require('cluster');
const os = require('os');
const path = require('path');
const logger = require('@saas/shared/utils/logger');

const app = require('./server');
const { connectWithRetry } = require('@saas/shared/utils/db');
const { runMigrationsIfNeeded } = require('@saas/shared/db/init');
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await connectWithRetry({ delayMs: 5000 });
    
    // 🔥 run DB setup
    await runMigrationsIfNeeded();

    app.listen(PORT, () => {
      logger.info('api-gateway.started', { pid: process.pid, port: PORT });
      console.log(`🚀 Service running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('api-gateway.start_failed', { error: err.message });
    process.exit(1);
  }
})();
