const axios = require("axios");
const http = require("http");
const https = require("https");
const { getBreaker } = require("./circuitBreaker");
const logger = require("./logger");

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || "internal_dev_token";

// 🔥 CPU WIN: HTTP KEEP-ALIVE
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 10,
  timeout: 60000,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100, // ⚡ Backpressure Control
  maxFreeSockets: 10,
  timeout: 60000,
});

// Configure axios defaults
const client = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 5000, // 🛡️ CRITICAL: Prevent long-hanging upstream calls
  headers: {
    "Content-Type": "application/json",
    "x-internal-token": INTERNAL_TOKEN,
  },
});

// One breaker instance per named service
const serviceBreakers = {};

function getServiceBreaker(serviceName) {
  if (!serviceBreakers[serviceName]) {
    serviceBreakers[serviceName] = getBreaker(serviceName, {
      threshold: 3,
      timeout: 2000,
      successRequired: 1,
    });
  }
  return serviceBreakers[serviceName];
}

async function callService(serviceName, url, method = "GET", body = null, headers = {}) {
  try {
    const response = await client({
      method,
      url,
      data: body,
      headers: {
        ...headers,
      },
    });

    return response.data;
  } catch (err) {
    if (err.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const error = new Error(`Service ${serviceName} responded ${err.response.status}`);
      error.status = err.response.status;
      error.data = err.response.data;
      throw error;
    } else if (err.request) {
      // The request was made but no response was received
      throw new Error(`Service ${serviceName} no response`);
    } else {
      // Something happened in setting up the request that triggered an Error
      throw err;
    }
  }
}

function callServiceAsync(serviceName, url, method = "GET", body = null) {
  callService(serviceName, url, method, body).catch((err) => {
    logger.warn(`Async service call failed (non-critical)`, {
      service: serviceName,
      url,
      error: err.message,
    });
  });
}

async function post(url, body, headers = {}) {
  const serviceName = url.split("//")[1]?.split(":")[0] || "unknown";
  return callService(serviceName, url, "POST", body, headers);
}

async function get(url, headers = {}) {
  const serviceName = url.split("//")[1]?.split(":")[0] || "unknown";
  return callService(serviceName, url, "GET", null, headers);
}

module.exports = { callService, callServiceAsync, getServiceBreaker, post, get };


