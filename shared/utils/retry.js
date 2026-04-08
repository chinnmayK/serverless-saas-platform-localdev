const logger = require('./logger');

async function retry(fn, options = {}) {
  const {
    retries = 3,
    delay = 200,
    factor = 2,
    shouldRetry = () => true
  } = options;

  let attempt = 0;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) {
        throw err;
      }

      const wait = delay * Math.pow(factor, attempt);
      logger.warn('utils.retry_wait', { attempt: attempt + 1, retries, wait, error: err.message });

      await new Promise(res => setTimeout(res, wait));
      attempt++;
    }
  }
}

module.exports = { retry };
