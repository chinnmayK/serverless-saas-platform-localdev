const cluster = require('cluster');
const os = require('os');
const path = require('path');

if (cluster.isPrimary) {
  const numCPUs = Math.min(os.cpus().length, 4); // Limit to 4 to avoid resource crunch
  console.log(`[Primary ${process.pid}] is running. Forking ${numCPUs} workers...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`[Worker ${worker.process.pid}] died. Forking a new worker...`);
    cluster.fork();
  });
} else {
  // Workers handle the server logic
  const app = require('./server'); // This is the renamed server.js
  const PORT = process.env.PORT || 3000;
  
  app.listen(PORT, () => {
    console.log(`[Worker ${process.pid}] [api-gateway] Running on port ${PORT}`);
  });
}
