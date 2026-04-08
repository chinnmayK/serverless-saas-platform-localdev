const express = require('express');
const router = express.Router();
const { streamProxy } = require('@saas/shared/utils/streamProxy');

// POST /api/onboarding — public endpoint, no auth
router.post('/onboarding', (req, res) => {
  const tenantServiceUrl = process.env.TENANT_SERVICE_URL || 'http://tenant-service.internal.serverless-saas-platform-localdev:3001';
  const targetUrl = `${tenantServiceUrl}/onboard`;
  streamProxy(req, res, targetUrl);
});

module.exports = router;
