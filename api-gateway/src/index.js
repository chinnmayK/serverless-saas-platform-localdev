require('@saas/shared');
const cluster = require('cluster');
const os = require('os');
const path = require('path');
const logger = require('@saas/shared/utils/logger');

if (cluster.isPrimary) {
  const numCPUs = Math.min(os.cpus().length, 4); // Limit to 4 to avoid resource crunch
  logger.info('cluster.primary.start', { pid: process.pid, numCPUs });

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.warn('cluster.worker.died', { workerPid: worker.process.pid, code, signal });
    cluster.fork();
  });
} else {
  require('@saas/shared/config/loadSecrets');
  const app = require('./server');
  const { connectWithRetry } = require('@saas/shared/utils/db');
  const { runMigrationsIfNeeded } = require('@saas/shared/db/init');
  const PORT = process.env.PORT || 3000;

  (async () => {
    await connectWithRetry({ delayMs: 5000 });
    
    // 🔥 run DB setup
    await runMigrationsIfNeeded();

    app.listen(PORT, () => {
      logger.info('api-gateway.started', { pid: process.pid, port: PORT });
    });
  })().catch((err) => {
    logger.error('api-gateway.start_failed', { error: err.message });
    process.exit(1);
  });
}
