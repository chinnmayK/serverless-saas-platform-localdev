const express = require('express');
const router = express.Router();
const { streamProxy } = require('@saas/shared/utils/streamProxy');
const billingRoutes = require('./billing');

// 🔥 SERVICE URLs (Discovery via Cloud Map in VPC)
const SERVICES = {
  tenant:  process.env.TENANT_SERVICE_URL  || 'http://tenant-service.internal.saas-platform:3000',
  user:    process.env.USER_SERVICE_URL    || 'http://user-service.internal.saas-platform:3000',
  billing: process.env.BILLING_SERVICE_URL || 'http://billing-service.internal.saas-platform:3000',
  file:    process.env.FILE_SERVICE_URL    || 'http://file-service.internal.saas-platform:3000',
};

// 🔥 GENERIC PROXY FUNCTION (STREAMING)
function proxyRequest(req, res, target) {
  const url = `${target}${req.path}`;
  streamProxy(req, res, url);
}

// 🔥 ROUTES

router.use('/tenants', (req, res) =>
  proxyRequest(req, res, SERVICES.tenant)
);

router.use('/users', (req, res) =>
  proxyRequest(req, res, SERVICES.user)
);

// Auth routes (hosted on user service but accessible at /api/auth/*)
router.use('/auth', (req, res) =>
  proxyRequest(req, res, SERVICES.user)
);

router.use('/billing', billingRoutes);


module.exports = router;
