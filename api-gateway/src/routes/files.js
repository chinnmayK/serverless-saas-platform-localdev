const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const router = express.Router();

router.use(
  '/',
  createProxyMiddleware({
    target: process.env.FILE_SERVICE_URL || 'http://file-service:3004',
    changeOrigin: true,
    pathRewrite: (path) => '/files' + path,
    on: { error: (err, req, res) => res.status(502).json({ error: 'File service unavailable' }) },
  })
);

module.exports = router;
