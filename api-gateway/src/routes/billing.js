const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const { getBreaker } = require('../../../shared/utils/circuitBreaker');
const { serviceClient } = require('@saas/shared/utils');
const { authMiddleware } = require('@saas/shared/middleware');
const router = express.Router();

const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || 'http://billing-service:3003';
const billingBreaker = getBreaker('billing-service', { threshold: 3, timeout: 15000 });

// Custom usage summary route
router.get('/usage', async (req, res) => {
  try {
    const data = await billingBreaker.execute(() => axios.get(`${BILLING_SERVICE_URL}/billing/usage`, {
      headers: req.headers,
    }));
    res.json(data.data);
  } catch (err) {
    res.status(200).json({
      success: false,
      message: 'Billing service unavailable',
      fallback: true,
    });
  }
});

router.post('/create-checkout', authMiddleware, async (req, res) => {
  const data = await serviceClient.post(`${BILLING_SERVICE_URL}/billing/create-checkout`, req.body, req.headers);
  res.json(data);
});

router.post('/portal', authMiddleware, async (req, res) => {
  const data = await serviceClient.post(`${BILLING_SERVICE_URL}/billing/portal`, {}, req.headers);
  res.json(data);
});

// Webhook — no auth, forward raw body
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const response = await fetch(`${BILLING_SERVICE_URL}/billing/webhook`, {
    method: 'POST',
    headers: { ...req.headers, host: BILLING_SERVICE_URL.replace(/^https?:\/\//, '') },
    body: req.body,
  });
  const data = await response.json();
  res.status(response.status).json(data);
});

// Proxy everything else
router.use(
  '/',
  createProxyMiddleware({
    target: process.env.BILLING_SERVICE_URL || 'http://billing-service:3003',
    changeOrigin: true,
    pathRewrite: (path) => '/billing' + path,
    on: { error: (err, req, res) => res.status(502).json({ error: 'Billing service unavailable' }) },
  })
);

module.exports = router;
