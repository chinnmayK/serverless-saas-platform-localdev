const express = require('express');
const authMiddleware = require('@saas/shared/middleware/authMiddleware');
const tenantMiddleware = require('@saas/shared/middleware/tenantMiddleware');
const usageMiddleware = require('@saas/shared/middleware/usageMiddleware');
const { serviceClient } = require('@saas/shared/utils/serviceClient');
const response = require('@saas/shared/utils/response');
const logger = require('@saas/shared/utils/logger');

const router = express.Router();
const axios = require('axios');

const FILE_SERVICE_URL = process.env.FILE_SERVICE_URL || 'http://file-service:3004';

router.post('/upload', authMiddleware, tenantMiddleware, usageMiddleware, async (req, res) => {
  const target = `${FILE_SERVICE_URL}/files/upload`;
  try {
    // Note: for multipart/form-data, we need to handle the stream if we were 
    // using a more complex proxy, but since we're using express.json() 
    // and no multipart middleware in the gateway, we need to be careful.
    // However, for this simple case, we'll just proxy the raw request headers and body.
    const response = await axios({
      method: 'POST',
      url: target,
      headers: {
        ...req.headers,
        host: 'file-service:3004'
      },
      data: req, // Pipe the request stream
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    logger.error('files.upload.failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Upload failed: ' + error.message });
  }
});

router.get('/:fileId/download', authMiddleware, tenantMiddleware, usageMiddleware, async (req, res) => {
  const target = `${FILE_SERVICE_URL}/files/${req.params.fileId}/download`;
  try {
    const response = await axios({
      method: 'GET',
      url: target,
      headers: {
        ...req.headers,
        host: 'file-service:3004'
      },
      responseType: 'stream'
    });
    res.set(response.headers);
    response.data.pipe(res);
  } catch (error) {
    if (error.response) {
      // If error is a stream, we might need to read it or just return a static JSON
      return res.status(error.response.status).json({ success: false, error: 'File not found' });
    }
    logger.error('files.download.failed', { error: error.message });
    res.status(404).json({ success: false, error: 'File not found' });
  }
});

module.exports = router;
