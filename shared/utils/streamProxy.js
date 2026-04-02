const http = require('http');
const logger = require('./logger');

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'internal_dev_token';

/**
 * Ultra-lightweight streaming proxy using native Node.js http module.
 * Does NOT parse bodies, just pipes streams.
 */
function streamProxy(req, res, targetUrl) {
  const target = new URL(targetUrl);
  
  const options = {
    hostname: target.hostname,
    port: target.port,
    path: target.pathname + target.search,
    method: req.method,
    headers: {
      ...req.headers,
      'host': target.host,
      'x-internal-token': INTERNAL_TOKEN,
    },
    timeout: 30000, // 30 seconds
  };

  // Remove headers that might interfere with the proxy
  delete options.headers['content-length']; // Let Node recalculate if needed, or better, pipe it.
  // Actually, if we pipe, we should keep content-length if it exists, 
  // BUT express.json() might have already consumed it if we were using it.
  // Since we are REMOVING express.json(), req is the raw stream.

  const proxyReq = http.request(options, (proxyRes) => {
    // Forward the status code and headers
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    
    // Pipe the response body
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    logger.error('Proxy Request Error', { url: targetUrl, error: err.message });
    if (!res.headersSent) {
      res.status(502).json({ 
        error: 'Bad Gateway', 
        message: 'Direct service communication failed',
        details: err.message
      });
    }
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      res.status(504).json({ error: 'Gateway Timeout' });
    }
  });

  // Pipe the request body (req) to the proxy request (proxyReq)
  req.pipe(proxyReq, { end: true });
}

module.exports = { streamProxy };
