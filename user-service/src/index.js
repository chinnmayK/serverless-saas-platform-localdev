const cluster = require('cluster');
const os = require('os');

if (cluster.isPrimary) {
  // ✅ FIX: Limit workers to avoid connection pool saturation & resource contention
  const numCPUs = Math.min(os.cpus().length, 4);
  console.log(`[Primary ${process.pid}] for user-service is running. Forking ${numCPUs} workers...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`[Worker ${worker.process.pid}] for user-service died. Forking a new worker...`);
    cluster.fork();
  });
} else {
  const app = require('./server'); 
  const PORT = process.env.PORT || 3002;
  
  app.listen(PORT, () => {
    console.log(`[Worker ${process.pid}] [user-service] Running on port ${PORT}`);
  });
}
