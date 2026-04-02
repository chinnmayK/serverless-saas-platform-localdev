const express = require('express');
const router = express.Router();
const { streamProxy } = require('@saas/shared/utils/streamProxy');

// 🔥 SERVICE URLs
const SERVICES = {
  billing: 'http://saas_billing_service:3003',
  file: 'http://saas_file_service:3004',
  tenant: 'http://saas_tenant_service:3001',
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
