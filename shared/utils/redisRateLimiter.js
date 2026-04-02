const { getRedisClient } = require('./redis');
const logger = require('./logger');
const { getPool } = require('./db');

let metrics = {
  rateLimitHits: { inc: () => {} },
  redisLatency: { observe: () => {} }
};

try {
  const apiMetrics = require('../../api-gateway/src/metrics');
  metrics.rateLimitHits = apiMetrics.rateLimitHits;
  metrics.redisLatency = apiMetrics.redisLatency;
} catch (e) {
  // Fallback
}

// 🔥 CPU WIN: QUOTA CACHE & THUNDERING HERD PROTECTION
const quotaCache = new Map();
const inFlightQuotaRequests = new Map(); // Promise locking for background fetch
const QUOTA_CACHE_TTL = 5 * 60 * 1000;

async function getTenantQuota(tenantId) {
  if (!tenantId) return { quota_requests_per_min: 100 };

  const now = Date.now();
  const cached = quotaCache.get(tenantId);
  if (cached && (now - cached.timestamp < QUOTA_CACHE_TTL)) {
    return cached.quota;
  }

  // 🛡️ BACKGROUND FETCH (NON-BLOCKING)
  // If we already have a fetch in flight, just return the DEFAULT while waiting.
  // This prevents the Gateway from "hanging" when a new tenant spikes.
  if (inFlightQuotaRequests.has(tenantId)) {
    return { quota_requests_per_min: 100 }; // Return safe default immediately
  }

  const fetchPromise = (async () => {
    const pool = getPool();
    try {
      const { rows } = await pool.query(
        `SELECT p.quota_requests_per_min
           FROM tenants t
           JOIN plans p ON p.id = t.plan
          WHERE t.tenant_id = $1`,
        [tenantId]
      );
      const quota = rows[0] ?? { quota_requests_per_min: 100 };
      quotaCache.set(tenantId, { quota, timestamp: Date.now() });
      return quota;
    } catch (err) {
      logger.error('Error fetching tenant quota', { tenantId, error: err.message });
      return { quota_requests_per_min: 100 };
    } finally {
      inFlightQuotaRequests.delete(tenantId);
    }
  })();

  inFlightQuotaRequests.set(tenantId, fetchPromise);
  
  // 🔥 CRITICAL WIN: DO NOT AWAIT the fetchPromise for the first request.
  // Return the default immediately and let the background fetch populate the cache.
  return { quota_requests_per_min: 100 };
}

function getLimits(path) {
  if (path.startsWith("/api/dashboard")) return { burst: 3000, steady: 20000 };
  if (path.startsWith("/api/users"))     return { burst: 4500, steady: 20000 };
  if (path.startsWith("/api/files"))     return { burst: 3000, steady: 15000 };
  return { burst: 3000, steady: 20000 };
}

class RedisRateLimiter {
  constructor(options = {}) {
    this.burstWindowMs = 60 * 1000;
    this.steadyWindowMs = 60 * 1000;
  }

  middleware() {
    return async (req, res, next) => {
      try {
        const client = await getRedisClient();
        const tenantId = req.tenantId || req.user?.tenantId;
        const { burst: configBurst, steady: configSteady } = getLimits(req.path);

        const keyBase = tenantId 
          ? `tenant:${tenantId}:user:${req.user?.user_id || 'anon'}`
          : `ip:${req.ip}`;

        const now = Date.now();
        const burstWindow = Math.floor(now / this.burstWindowMs);
        const burstKey = `rate:burst:${keyBase}:${burstWindow}`;
        const steadyWindow = Math.floor(now / this.steadyWindowMs);
        const steadyKey = `rate:steady:${keyBase}:${steadyWindow}`;

        const start = Date.now();

        // ⚡ INVERSE PRIORITY: Increment first (very fast)
        const [burstCount, steadyCount] = await Promise.all([
          client.incr(burstKey),
          client.incr(steadyKey)
        ]);
        
        if (burstCount === 1) await client.expire(burstKey, 60);
        if (steadyCount === 1) await client.expire(steadyKey, 3600);
        
        metrics.redisLatency.observe({ operation: 'rate_limit' }, Date.now() - start);

        // 🔍 CHECK AGAINST QUOTA (NON-BLOCKING)
        const quota = await getTenantQuota(tenantId);
        const limit = Math.max(quota.quota_requests_per_min || 0, configBurst);

        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - burstCount));

        if (burstCount > limit || steadyCount > configSteady) {
          const type = burstCount > limit ? 'Burst' : 'Steady';
          logger.warn('Rate Limit Exceeded', { key: keyBase, type });
          res.setHeader('Retry-After', 60);
          metrics.rateLimitHits.inc({ tenant_id: tenantId || 'unknown', endpoint: req.path });
          
          return res.status(429).json({ 
            error: 'Rate limit exceeded',
            type,
            limit: type === 'Burst' ? limit : configSteady
          });
        }

        next();
      } catch (err) {
        logger.error('Rate limit error', { error: err.message });
        next();
      }
    };
  }
}

const rateLimiterFactory = (options) => {
  const limiter = new RedisRateLimiter(options);
  return limiter.middleware();
};

module.exports = rateLimiterFactory;
module.exports.RedisRateLimiter = RedisRateLimiter;
module.exports.getTenantQuota = getTenantQuota;
