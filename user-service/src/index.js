require('@saas/shared');
const cluster = require('cluster');
const os = require('os');
const logger = require('@saas/shared/utils/logger');
const { connectWithRetry } = require('@saas/shared/utils/db');

const app = require('./server'); 
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await connectWithRetry({ delayMs: 5000 });
    
    app.listen(PORT, () => {
      logger.info('user-service.started', { pid: process.pid, port: PORT });
      console.log(`🚀 Service running on port ${PORT}`);
    });
  } catch (err) {
    logger.error("user-service.start_failed", { error: err.message });
    process.exit(1);
  }
})();
