const express = require('express');
const app = express();

// ✅ BODY PARSER FIRST
app.use(express.json());

// ✅ IMPORTS
const requestLogger = require('@saas/shared/middleware/requestLogger');
const { authMiddleware, tenantMiddleware, usageMiddleware } = require('@saas/shared/middleware');
const RedisRateLimiter = require('@saas/shared/utils/redisRateLimiter');

const routes = require('./routes/internal');

// ✅ PUBLIC ROUTES FIRST (NO AUTH)
app.get('/health', (req, res) => res.send('OK'));

// 🔥 LOGGER (must be early)
app.use(requestLogger);

// 🔥 RATE LIMITER
const rateLimiter = new RedisRateLimiter({
  windowMs: 60000,
  maxRequests: 100
});
app.use(rateLimiter.middleware());

// 🔥 CONDITIONAL AUTH
app.use((req, res, next) => {
  const publicRoutes = [
    { method: 'POST', path: '/api/tenants' },
    { method: 'POST', path: '/api/users/auth/register' },
    { method: 'POST', path: '/api/users/auth/login' },
    { method: 'POST', path: '/api/auth/register' },
    { method: 'POST', path: '/api/auth/login' },
  ];

  const isPublic = publicRoutes.some(
    (route) =>
      route.method === req.method &&
      req.originalUrl.startsWith(route.path)
  );

  if (isPublic) {
    return next();
  }

  return authMiddleware(req, res, next);
});

// 🔥 TENANT (skip for public routes)
app.use((req, res, next) => {
  const publicRoutes = [
    { method: 'POST', path: '/api/tenants' },
    { method: 'POST', path: '/api/users/auth/register' },
    { method: 'POST', path: '/api/users/auth/login' },
    { method: 'POST', path: '/api/auth/register' },
    { method: 'POST', path: '/api/auth/login' },
  ];

  const isPublic = publicRoutes.some(
    (route) =>
      route.method === req.method &&
      req.originalUrl.startsWith(route.path)
  );

  if (isPublic) {
    return next();
  }
  return tenantMiddleware(req, res, next);
});

// 🔥 USAGE
app.use(usageMiddleware);

// 🔥 ROUTES
app.use('/api', routes);

// Standard Express app export
module.exports = app;

// Add listening logic if run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[api-gateway] Running on port ${PORT}`);
  });
}
