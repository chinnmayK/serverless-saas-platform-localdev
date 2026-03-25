const Minio = require("minio");

const BUCKET = process.env.MINIO_BUCKET || "saas-files";

const client = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: parseInt(process.env.MINIO_PORT || "9000"),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin123",
});

/**
 * Ensure the bucket exists. Called on service startup.
 */
async function ensureBucket() {
  const exists = await client.bucketExists(BUCKET);
  if (!exists) {
    await client.makeBucket(BUCKET, "us-east-1");
    console.log(`[file-service] Created MinIO bucket: ${BUCKET}`);
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
  await client.putObject(BUCKET, key, buffer, buffer.length, {
    "Content-Type": mimetype,
  });
  return { key, bucket: BUCKET };
}

/**
 * Get a temporary pre-signed download URL (valid 1 hour).
 */
async function getDownloadUrl(key) {
  return client.presignedGetObject(BUCKET, key, 60 * 60);
}

/**
 * Delete a file from MinIO.
 */
async function deleteFile(key) {
  await client.removeObject(BUCKET, key);
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

module.exports = { ensureBucket, uploadFile, getDownloadUrl, deleteFile, assertKeyBelongsToTenant };
