const express = require("express");
const router = express.Router();
const db = require("@saas/shared/utils/db");
const response = require("@saas/shared/utils/response");
const auth = require("@saas/shared/middleware/authMiddleware");
const tenantCtx = require("@saas/shared/middleware/tenantMiddleware");
const { requireRole } = require("@saas/shared/middleware/rbacMiddleware");
const storage = require("./storage");
const { assertKeyBelongsToTenant } = storage;
const upload = require("./upload");
const logger = require("@saas/shared/utils/logger");
const trackUsage = require("@saas/shared/middleware/usageMiddleware");
const { getServiceBreaker } = require("@saas/shared/utils/serviceClient");
const billingBreaker = getServiceBreaker("billing-service", process.env.BILLING_SERVICE_URL);

// All file routes are protected
router.use(auth, tenantCtx);

// POST /files/upload — upload a file (tenant-scoped)
router.post("/upload", upload.single("file"), trackUsage, async (req, res) => {
  try {
    if (!req.file) return response.badRequest(res, "No file provided (field name: file)");

    const { tenantId, userId } = req.user;

    const { key, bucket } = await storage.uploadFile({
      tenantId,
      userId,
      filename: req.file.originalname,
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
    });

    // Save file metadata to Postgres
    const result = await db.tenantQuery(
      tenantId,
      `INSERT INTO files (tenant_id, user_id, original_name, storage_key, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenantId, userId, req.file.originalname, key, req.file.mimetype, req.file.size]
    );

    // Audit log file upload
    logger.audit("file.uploaded", {
      tenantId: req.tenantId,
      userId: req.userId,
      fileId: result.rows[0].file_id,
      fileName: req.file.originalname,
      sizeBytes: req.file.size,
    });

    return response.created(res, result.rows[0]);
  } catch (err) {
    return response.error(res, err.message);
  }
});

// GET /files — list all files for this tenant
router.get("/", trackUsage, async (req, res) => {
  try {
    const result = await db.tenantQuery(
      req.tenantId,
      `SELECT file_id, original_name, mime_type, size_bytes, created_at, user_id
       FROM files
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`,
      []
    );
    return response.success(res, result.rows);
  } catch (err) {
    return response.error(res, err.message);
  }
});

// GET /files/:id/download — get pre-signed download URL
router.get("/:id/download", trackUsage, async (req, res) => {
  try {
    // Ensure file belongs to caller's tenant and is not deleted
    const result = await db.tenantQuery(
      req.tenantId,
      `SELECT * FROM files WHERE file_id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    const file = result.rows[0];
    if (!file) return response.notFound(res, "File not found");
    
    assertKeyBelongsToTenant(file.storage_key, req.tenantId);
    const url = await storage.getDownloadUrl(file.storage_key);
    return response.success(res, { url, expiresIn: "1 hour", file });
  } catch (err) {
    return response.error(res, err.message);
  }
});

// DELETE /files/:id — delete a file (soft delete) - admin or member only
router.delete("/:id", auth, tenantCtx, requireRole("admin", "member"), async (req, res) => {
  try {
    const result = await db.tenantQuery(
      req.tenantId,
      `SELECT * FROM files WHERE file_id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    const file = result.rows[0];
    if (!file) return response.notFound(res, "File not found");

    assertKeyBelongsToTenant(file.storage_key, req.tenantId);

    // Remove from MinIO
    await storage.deleteFile(file.storage_key);

    // Soft delete metadata from DB
    await db.tenantQuery(
      req.tenantId,
      `UPDATE files SET deleted_at = NOW() WHERE file_id = $1`,
      [req.params.id]
    );

    return response.success(res, { deleted: true, fileId: req.params.id });
  } catch (err) {
    return response.error(res, err.message);
  }
});

module.exports = router;
