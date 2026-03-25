const { getBreaker } = require("./circuitBreaker");  // ← correct export name
const logger = require("./logger");

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || "internal_dev_token";

// One breaker instance per named service — singletons via getBreaker registry
const serviceBreakers = {};

function getServiceBreaker(serviceName) {
  if (!serviceBreakers[serviceName]) {
    serviceBreakers[serviceName] = getBreaker(serviceName, {
      threshold:       3,
      timeout:         15000,
      successRequired: 1,
    });
  }
  return serviceBreakers[serviceName];
}

async function callService(serviceName, url, method = "GET", body = null) {
  const breaker = getServiceBreaker(serviceName);

  return breaker.execute(
    async () => {
      const opts = {
        method,
        headers: {
          "Content-Type":     "application/json",
          "x-internal-token": INTERNAL_TOKEN,
        },
      };

      if (body && !["GET", "HEAD"].includes(method)) {
        opts.body = JSON.stringify(body);
      }

      const response = await fetch(url, opts);

      if (!response.ok) {
        const err = new Error(`Service ${serviceName} responded ${response.status}`);
        err.status = response.status;
        throw err;
      }

      return response.json();
    },
    null  // no fallback — callers decide what to do on open circuit
  );
}

// Fire-and-forget variant — used for usage tracking where failure must not
// affect the main request. Swallows all errors silently.
function callServiceAsync(serviceName, url, method = "GET", body = null) {
  callService(serviceName, url, method, body).catch((err) => {
    logger.warn(`Async service call failed (non-critical)`, {
      service: serviceName,
      url,
      error: err.message,
    });
  });
}

module.exports = { callService, callServiceAsync, getServiceBreaker };
