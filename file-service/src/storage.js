const { MinioClient: client } = require("@saas/shared/utils");

const bucket = process.env.MINIO_BUCKET;

async function initBucket() {
  const exists = await client.bucketExists(bucket).catch(() => false);
  if (!exists) {
    await client.makeBucket(bucket);
    console.log('✅ Bucket created:', bucket);
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
 * Upload a buffer to MinIO.
 */
async function uploadFile({ tenantId, userId, filename, buffer, mimetype }) {
  const key = buildKey(tenantId, userId, filename);
  await client.putObject(bucket, key, buffer, buffer.length, {
    "Content-Type": mimetype,
  });
  return { key, bucket: bucket };
}

/**
 * Get a temporary pre-signed download URL (valid 1 hour).
 */
async function getDownloadUrl(key) {
  return client.presignedGetObject(bucket, key, 60 * 60);
}

/**
 * Delete a file from MinIO.
 */
async function deleteFile(key) {
  await client.removeObject(bucket, key);
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

module.exports = { client, bucket, initBucket, uploadFile, getDownloadUrl, deleteFile, assertKeyBelongsToTenant };
