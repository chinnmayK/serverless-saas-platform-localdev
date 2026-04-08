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
  // Workers handle the server logic
  const app = require('./server'); // This is the renamed server.js
  const PORT = process.env.PORT || 3000;
  
  app.listen(PORT, () => {
    logger.info('api-gateway.started', { pid: process.pid, port: PORT });
  });
}
