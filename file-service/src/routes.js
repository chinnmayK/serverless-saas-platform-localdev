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
const { getServiceBreaker } = require("@saas/shared/utils/serviceClient");
const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || 'http://billing-service:3003';
const billingBreaker = getServiceBreaker("billing-service", BILLING_SERVICE_URL);

// All file routes are protected
router.use(auth, tenantCtx);

const mapper = require("@saas/shared/utils/mapper");

// POST /files/upload — upload a file (tenant-scoped)
router.post("/upload", upload.single("file"), async (req, res) => {
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

    const file = mapper.mapFile(result.rows[0]);

    // Audit log file upload
    logger.info("file.uploaded", {
      tenantId: req.tenantId,
      userId: req.userId,
      fileId: file.fileId,
      fileName: file.originalName,
      sizeBytes: file.sizeBytes,
    });

    return response.created(res, file);
  } catch (err) {
    return response.error(res, err.message);
  }
});

// GET /files — list all files for this tenant
router.get("/", async (req, res) => {
  try {
    const result = await db.tenantQuery(
      req.tenantId,
      `SELECT * FROM files
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`,
      []
    );
    return response.success(res, result.rows.map(mapper.mapFile));
  } catch (err) {
    return response.error(res, err.message);
  }
});

// GET /files/:id/download — get pre-signed download URL
router.get("/:id/download", async (req, res) => {
  try {
    const result = await db.tenantQuery(
      req.tenantId,
      `SELECT * FROM files WHERE file_id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    const file = mapper.mapFile(result.rows[0]);
    if (!file) return response.notFound(res, "File not found");
    
    // assertKeyBelongsToTenant logic uses storage_key — which is hidden in mapFile
    // but the raw record had it. Need to keep raw file for internal logic.
    const rawFile = result.rows[0];
    assertKeyBelongsToTenant(rawFile.storage_key, req.tenantId);
    
    const url = await storage.getDownloadUrl(rawFile.storage_key);
    return response.success(res, { url, expiresIn: "1 hour", file });
  } catch (err) {
    return response.error(res, err.message);
  }
});

// DELETE /files/:id — delete a file (soft delete)
router.delete("/:id", auth, tenantCtx, requireRole("admin", "member"), async (req, res) => {
  try {
    const result = await db.tenantQuery(
      req.tenantId,
      `SELECT * FROM files WHERE file_id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    const rawFile = result.rows[0];
    if (!rawFile) return response.notFound(res, "File not found");

    assertKeyBelongsToTenant(rawFile.storage_key, req.tenantId);
    await storage.deleteFile(rawFile.storage_key);

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

// GET /dashboard/files — summary for tenant dashboard
router.get("/dashboard/files", async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const [stats, recent] = await Promise.all([
      db.tenantQuery(
        tenantId,
        `SELECT COUNT(*) as total_files, COALESCE(SUM(size_bytes), 0) as total_size 
         FROM files 
         WHERE tenant_id = $1 AND deleted_at IS NULL`,
        [tenantId]
      ),
      db.tenantQuery(
        tenantId,
        `SELECT * 
         FROM files 
         WHERE tenant_id = $1 AND deleted_at IS NULL 
         ORDER BY created_at DESC 
         LIMIT 5`,
        [tenantId]
      ),
    ]);

    return response.success(res, {
      totalFiles: parseInt(stats.rows[0].total_files, 10), // Use camelCase
      totalSize: parseInt(stats.rows[0].total_size, 10),   // Use camelCase
      recentFiles: recent.rows.map(mapper.mapFile),
    });
  } catch (err) {
    return response.error(res, err.message);
  }
});

module.exports = router;
