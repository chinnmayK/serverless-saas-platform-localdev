const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const { getBreaker } = require('../../../shared/utils/circuitBreaker');
const router = express.Router();

const billingBreaker = getBreaker('billing-service', { threshold: 3, timeout: 15000 });

// Custom usage summary route
router.get('/usage', async (req, res) => {
  try {
    const data = await billingBreaker.execute(() => axios.get('http://billing-service:3003/billing/usage', {
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
