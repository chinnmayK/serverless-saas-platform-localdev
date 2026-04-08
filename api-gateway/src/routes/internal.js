const express = require('express');
const router = express.Router();
const { streamProxy } = require('@saas/shared/utils/streamProxy');
const billingRoutes = require('./billing');

// 🔥 SERVICE URLs (Docker service names)
const SERVICES = {
  tenant: process.env.TENANT_SERVICE_URL || 'http://tenant-service.internal.serverless-saas-platform-localdev:3001',
  user: process.env.USER_SERVICE_URL || 'http://user-service.internal.serverless-saas-platform-localdev:3002',
  billing: process.env.BILLING_SERVICE_URL || 'http://billing-service.internal.serverless-saas-platform-localdev:3003',
  file: process.env.FILE_SERVICE_URL || 'http://file-service.internal.serverless-saas-platform-localdev:3004',
};

// 🔥 GENERIC PROXY FUNCTION (STREAMING)
function proxyRequest(req, res, target) {
  const fullPath = (req.baseUrl || '').replace('/api', '') + req.path;
  const url = `${target}${fullPath}`;
  streamProxy(req, res, url);
}

// 🔥 ROUTES

router.use('/tenants', (req, res) =>
  proxyRequest(req, res, SERVICES.tenant)
);

router.use('/users', (req, res) =>
  proxyRequest(req, res, SERVICES.user)
);

// Auth routes (part of user service)
router.use('/auth', (req, res) =>
  proxyRequest(req, res, SERVICES.user)
);

router.use('/billing', billingRoutes);


module.exports = router;
