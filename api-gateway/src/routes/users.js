const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const router = express.Router();

router.use(
  '/',
  createProxyMiddleware({
    target: process.env.USER_SERVICE_URL || 'http://user-service:3002',
    changeOrigin: true,
    pathRewrite: (path, req) => {
        // Since this router might be used for both /auth and /users in internal.js
        // we should be careful. But internal.js mounts them separately.
        // If mounted at /auth, path is /login -> should become /auth/login
        // We can just use the originalUrl if we want to be safe, but let's see.
        return (req.baseUrl.endsWith('auth') ? '/auth' : '/users') + path;
    },
    on: { error: (err, req, res) => res.status(502).json({ error: 'User service unavailable' }) },
  })
);

module.exports = router;
