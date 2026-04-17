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
    // 🔥 1. run DB setup first (uses dbadmin pool)
    await runMigrationsIfNeeded();

    // ✅ 2. Now verify the application-level connection (uses app_user)
    await connectWithRetry({ delayMs: 5000 });
    
    app.listen(PORT, () => {
      logger.info('api-gateway.started', { pid: process.pid, port: PORT });
      console.log(`🚀 Service running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('api-gateway.start_failed', { error: err.message });
    process.exit(1);
  }
})();
