const client = require('prom-client');

// Collect default Node.js metrics (CPU, memory, event loop)
client.collectDefaultMetrics();

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const rateLimitHits = new client.Counter({
  name: 'rate_limit_hits',
  help: 'Total rate limit rejections',
  labelNames: ['tenant_id', 'endpoint'],
});

const requestSuccessTotal = new client.Counter({
  name: 'request_success_total',
  help: 'Total successful requests',
  labelNames: ['endpoint', 'status'],
});

const tenantRequestsTotal = new client.Counter({
  name: 'tenant_requests_total',
  help: 'Total requests per tenant',
  labelNames: ['tenant_id'],
});

const redisLatency = new client.Histogram({
  name: 'redis_latency',
  help: 'Latency of Redis operations in ms',
  labelNames: ['operation'],
  buckets: [1, 5, 10, 20, 50, 100],
});

module.exports = { 
  client, 
  httpRequestDuration, 
  httpRequestTotal, 
  rateLimitHits,
  requestSuccessTotal,
  tenantRequestsTotal,
  redisLatency
};

