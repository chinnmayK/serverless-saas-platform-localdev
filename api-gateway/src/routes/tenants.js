const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const router = express.Router();

router.use(
  '/',
  createProxyMiddleware({
    target: process.env.TENANT_SERVICE_URL || 'http://tenant-service:3001',
    changeOrigin: true,
    pathRewrite: (path) => '/tenants' + path,
    on: { error: (err, req, res) => res.status(502).json({ error: 'Tenant service unavailable' }) },
  })
);

module.exports = router;
