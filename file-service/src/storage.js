const s3 = require("@saas/shared/utils/s3");
const logger = require("@saas/shared/utils/logger");

const bucket = process.env.S3_BUCKET || "saas-platform-uploads";

/**
 * Ensure the S3 bucket exists. Creates it if missing.
 */
async function initBucket() {
  try {
    await s3.headBucket({ Bucket: bucket }).promise();
    logger.info("file-service.storage.bucket_exists", { bucket });
  } catch (err) {
    if (err.statusCode === 404 || err.code === "NotFound") {
      await s3.createBucket({ Bucket: bucket }).promise();
      logger.info("file-service.storage.bucket_created", { bucket });
    } else {
      throw err;
    }
  }
}

/**
 * Build the object key for a file, scoped to tenant.
 * Structure: <tenantId>/<userId>/<filename>
 */
function buildKey(tenantId, userId, filename) {
  return `${tenantId}/${userId}/${Date.now()}_${filename}`;
}

/**
 * Upload a buffer to S3.
 */
async function uploadFile({ tenantId, userId, filename, buffer, mimetype }) {
  const key = buildKey(tenantId, userId, filename);
  await s3.putObject({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
  }).promise();
  return { key, bucket };
}

/**
 * Get a temporary pre-signed download URL (valid 1 hour).
 */
function getDownloadUrl(key) {
  return s3.getSignedUrlPromise("getObject", {
    Bucket: bucket,
    Key: key,
    Expires: 3600, // 1 hour
  });
}

/**
 * Delete a file from S3.
 */
async function deleteFile(key) {
  await s3.deleteObject({
    Bucket: bucket,
    Key: key,
  }).promise();
}

/**
 * Validates that a storage key actually belongs to the requesting tenant.
 * Prevents path traversal and cross-tenant file access.
 */
function assertKeyBelongsToTenant(key, tenantId) {
  if (!key.startsWith(`${tenantId}/`)) {
    throw new Error(`Access denied: file does not belong to tenant ${tenantId}`);
  }
}

module.exports = { bucket, initBucket, uploadFile, getDownloadUrl, deleteFile, assertKeyBelongsToTenant };
