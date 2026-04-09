require('@saas/shared');
const cluster = require('cluster');
const os = require('os');
const logger = require('@saas/shared/utils/logger');
const { connectWithRetry } = require('@saas/shared/utils/db');

if (cluster.isPrimary) {
  // ✅ FIX: Limit workers to avoid connection pool saturation & resource contention
  const numCPUs = Math.min(os.cpus().length, 4);
  logger.info('user-service.primary.start', { pid: process.pid, numCPUs });

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.warn('user-service.worker.died', { workerPid: worker.process.pid, code, signal });
    cluster.fork();
  });
} else {
  const app = require('./server'); 
  const PORT = process.env.PORT || 3000;

  async function start() {
    await connectWithRetry({ delayMs: 5000 });
    app.listen(PORT, () => {
      logger.info('user-service.started', { pid: process.pid, port: PORT });
    });
  }

  start().catch((err) => {
    logger.error("user-service.start_failed", { error: err.message });
    process.exit(1);
  });
}
