const express = require('express');
const router = express.Router();
const { streamProxy } = require('@saas/shared/utils/streamProxy');

// 🔥 SERVICE URLs
const SERVICES = {
  billing: process.env.BILLING_SERVICE_URL || 'http://billing-service.internal.saas-platform:3000',
  file:    process.env.FILE_SERVICE_URL    || 'http://file-service.internal.saas-platform:3000',
  tenant:  process.env.TENANT_SERVICE_URL  || 'http://tenant-service.internal.saas-platform:3000',
};

// 🔥 DASHBOARD PROXY HANDLER (STREAMING)
function proxyDashboard(req, res, target, path) {
  const url = `${target}${path}`;
  streamProxy(req, res, url);
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// GET /api/dashboard/usage -> billing-service
router.get('/usage', (req, res) => {
  proxyDashboard(req, res, SERVICES.billing, '/billing/dashboard/usage');
});

// GET /api/dashboard/billing -> billing-service
router.get('/billing', (req, res) => {
  proxyDashboard(req, res, SERVICES.billing, '/billing/dashboard/billing');
});

// GET /api/dashboard/files -> file-service
router.get('/files', (req, res) => {
  proxyDashboard(req, res, SERVICES.file, '/files/dashboard/files');
});

// GET /api/dashboard/activity -> tenant-service
router.get('/activity', (req, res) => {
  proxyDashboard(req, res, SERVICES.tenant, '/dashboard/activity');
});

module.exports = router;
