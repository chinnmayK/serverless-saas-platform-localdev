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
      console.warn(`⏳ Retry ${attempt + 1}/${retries} in ${wait}ms`);

      await new Promise(res => setTimeout(res, wait));
      attempt++;
    }
  }
}

module.exports = { retry };
