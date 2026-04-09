const secretsJson = process.env.APP_SECRETS || "{}";
let secrets = {};

try {
  secrets = JSON.parse(secretsJson);
} catch (err) {
  console.error('Failed to parse APP_SECRETS', err);
  process.exit(1);
}

const envKeys = [
  'JWT_SECRET',
  'REDIS_URL',
  'DB_PASSWORD',
  'DATABASE_URL',
  'INTERNAL_SERVICE_TOKEN',
  'FRONTEND_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'MINIO_ENDPOINT',
  'MINIO_PORT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_BUCKET'
];

envKeys.forEach((key) => {
  if (Object.prototype.hasOwnProperty.call(secrets, key) && secrets[key] !== undefined) {
    process.env[key] = String(secrets[key]);
  }
});

module.exports = {
  middleware: require("./middleware"),
  utils: require("./utils")
};
