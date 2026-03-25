const redis = require('redis');
const logger = require('./logger');

class RedisRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000;
    this.maxRequests = options.maxRequests || 100;

    this.client = redis.createClient({
      url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:6379`
    });

    this.client.connect().catch(console.error);
  }

  middleware() {
    return async (req, res, next) => {
      logger.info('Rate Limiter Triggered');
      try {
        const key = req.user?.tenantId || req.ip;
        const window = Math.floor(Date.now() / this.windowMs);
        const redisKey = `rate:${key}:${window}`;

        const count = await this.client.incr(redisKey);

        logger.info('Rate Limit Check', { key, count });

        if (count === 1) {
          await this.client.expire(redisKey, 60);
        }

        if (count > this.maxRequests) {
          logger.warn('Rate Limit Exceeded', { key, count });
          return res.status(429).json({ error: 'Too Many Requests' });
        }

        next();
      } catch (err) {
        logger.error('Rate limit error', { error: err.message, key: req.ip });
        next();
      }
    };
  }
}

module.exports = RedisRateLimiter;
