const express = require('express');
const router = express.Router();
const { streamProxy } = require('@saas/shared/utils/streamProxy');
const billingRoutes = require('./billing');

// 🔥 SERVICE URLs (Docker service names)
const SERVICES = {
  tenant: process.env.TENANT_SERVICE_URL || 'http://localhost:3001',
  user: process.env.USER_SERVICE_URL || 'http://localhost:3002',
  billing: process.env.BILLING_SERVICE_URL || 'http://localhost:3003',
  file: process.env.FILE_SERVICE_URL || 'http://localhost:3004',
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
