const logger = require('../utils/logger');

module.exports = (req, res, next) => {
  const start = Date.now();

  const requestData = {
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    body: req.body,
    tenantId: req.user?.tenantId,
    userId: req.user?.userId,
    ip: req.ip,
  };

  logger.info('Incoming Request', requestData);

  // Capture response
  const originalSend = res.send;

  res.send = function (body) {
    const duration = Date.now() - start;

    logger.info('Outgoing Response', {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseBody: body,
      method: req.method,
      url: req.originalUrl,
    });

    return originalSend.call(this, body);
  };

  next();
};
