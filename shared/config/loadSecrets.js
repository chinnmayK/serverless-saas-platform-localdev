// shared/config/loadSecrets.js
// Centralized secret loader — must be required FIRST in every service entry point.
// Parses the APP_SECRETS JSON blob injected by ECS/Secrets Manager and promotes
// each key to a top-level process.env variable.

if (process.env.APP_SECRETS) {
  const s = JSON.parse(process.env.APP_SECRETS);

  process.env.DATABASE_URL           = s.DATABASE_URL;
  process.env.REDIS_URL              = s.REDIS_URL;
  process.env.JWT_SECRET             = s.JWT_SECRET;
  process.env.DB_PASSWORD            = s.DB_PASSWORD;
  process.env.INTERNAL_SERVICE_TOKEN = s.INTERNAL_SERVICE_TOKEN;
  process.env.FRONTEND_URL           = s.FRONTEND_URL;
  process.env.STRIPE_SECRET_KEY      = s.STRIPE_SECRET_KEY;
  process.env.STRIPE_WEBHOOK_SECRET  = s.STRIPE_WEBHOOK_SECRET;
  process.env.MINIO_ENDPOINT         = s.MINIO_ENDPOINT;
  process.env.MINIO_PORT             = s.MINIO_PORT;
  process.env.MINIO_ACCESS_KEY       = s.MINIO_ACCESS_KEY;
  process.env.MINIO_SECRET_KEY       = s.MINIO_SECRET_KEY;
  process.env.MINIO_BUCKET           = s.MINIO_BUCKET;
}
