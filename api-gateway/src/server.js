require('./tracing');

const express = require('express');
const app = express();


// ✅ IMPORTS
const requestLogger = require('@saas/shared/middleware/requestLogger');
const { authMiddleware, tenantMiddleware, usageMiddleware } = require('@saas/shared/middleware');
const rateLimiter = require('../../shared/utils/redisRateLimiter');

const routes = require('./routes/internal');
const filesRoutes = require('./routes/files');
const tenantRoutes = require('./routes/tenants');
const dashboardRoutes = require('./routes/dashboard');
const { client, httpRequestDuration, httpRequestTotal, requestSuccessTotal, tenantRequestsTotal } = require('./metrics');

// Timing middleware — place BEFORE your routes
app.use((req, res, next) => {
  console.log(`[GW-REQ] ${req.method} ${req.url}`);
  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
    };
    end(labels);
    httpRequestTotal.inc(labels);

    // ✅ NEW: Specific metrics for Prometheus
    requestSuccessTotal.inc({ 
      endpoint: req.route?.path || req.path, 
      status: res.statusCode 
    });
  });

  next();
});


// ✅ PUBLIC ROUTES FIRST (NO AUTH)
app.get('/health', (req, res) => res.send('OK'));

// ✅ Top-level /onboarding proxy (public, no /api prefix needed)
const { streamProxy } = require('@saas/shared/utils/streamProxy');
app.post('/onboarding', (req, res) => {
  const tenantServiceUrl = process.env.TENANT_SERVICE_URL || 'http://localhost:3001';
  streamProxy(req, res, `${tenantServiceUrl}/onboard`);
});

// Metrics endpoint — place AFTER middleware, BEFORE other routes
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});


// 🔥 LOGGER (must be early)
// app.use(requestLogger);

// 🔥 PUBLIC — must be before global auth guard
app.use('/api', tenantRoutes);


// 🔥 CONSOLIDATED PUBLIC ROUTE CHECK
app.use((req, res, next) => {
  const publicRoutes = [
    { method: 'POST', path: '/api/onboarding' },
    { method: 'POST', path: '/onboarding' },
    { method: 'POST', path: '/api/users/auth/register' },
    { method: 'POST', path: '/api/users/auth/login' },
    { method: 'POST', path: '/api/auth/register' },
    { method: 'POST', path: '/api/auth/login' },
  ];

  req.isPublic = publicRoutes.some(
    (route) =>
      route.method === req.method &&
      req.originalUrl.startsWith(route.path)
  );

  next();
});

// 🔥 CONDITIONAL AUTH
app.use((req, res, next) => {
  if (req.isPublic) {
    return next();
  }
  return authMiddleware(req, res, next);
});

// 🔥 RATE LIMIT (Now with decoded user/tenant context)
app.use(rateLimiter());

// 🔥 TENANT (skip for public routes)
app.use((req, res, next) => {
  if (req.isPublic) {
    return next();
  }
  return tenantMiddleware(req, res, next);
});

// 🔥 USAGE
app.use(usageMiddleware);


// 🔥 ROUTES
app.use('/api/files', filesRoutes);
app.use('/api/dashboard', dashboardRoutes);
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
