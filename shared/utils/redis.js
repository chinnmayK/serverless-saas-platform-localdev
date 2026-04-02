const redis = require('redis');
const logger = require('./logger');

const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:6379`;

let client = null;

async function getRedisClient() {
  if (client) return client;

  client = redis.createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
    }
  });

  client.on('error', (err) => logger.error('Redis Error', { error: err.message }));
  client.on('connect', () => logger.info('Redis Connected'));

  await client.connect();
  return client;
}

module.exports = { getRedisClient };
