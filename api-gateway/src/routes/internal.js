const express = require('express');
const router = express.Router();
const axios = require('axios');

// 🔥 SERVICE URLs (Docker service names)
const SERVICES = {
  tenant: 'http://saas_tenant_service:3001',
  user: 'http://saas_user_service:3002',
  billing: 'http://saas_billing_service:3003',
  file: 'http://saas_file_service:3004',
};

// 🔥 GENERIC PROXY FUNCTION
async function proxyRequest(req, res, target) {
  try {
    // Use baseUrl + path to reconstruct the full path from the mounted router
    // baseUrl will be /api/tenants or /api/users, etc.
    // path will be / for top-level or /auth/register for nested
    const fullPath = req.baseUrl.replace('/api', '') + req.path;
    
    const response = await axios({
      method: req.method,
      url: `${target}${fullPath}`,
      headers: {
        ...req.headers,
      },
      data: req.body,
    });

    res.status(response.status).json(response.data);
  } catch (err) {
    console.error('Proxy Error:', err.message);

    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }

    res.status(500).json({ error: 'Gateway Error' });
  }
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

router.use('/billing', (req, res) =>
  proxyRequest(req, res, SERVICES.billing)
);

router.use('/files', (req, res) =>
  proxyRequest(req, res, SERVICES.file)
);

module.exports = router;
