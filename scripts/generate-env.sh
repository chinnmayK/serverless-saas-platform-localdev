#!/bin/bash

set -e

echo "Generating .env files..."

SERVICES=(api-gateway user-service tenant-service billing-service file-service worker-service)

for SERVICE in "${SERVICES[@]}"
do
  case "$SERVICE" in
    api-gateway)
      cat <<EOF > "$SERVICE/.env"
NODE_ENV=${NODE_ENV:-production}
PORT=${PORT:-3000}

JWT_SECRET=${JWT_SECRET:-replace-me-in-prod}
REDIS_URL=${REDIS_URL:-redis://localhost:6379}
DB_PASSWORD=${DB_PASSWORD:-app_password}
DATABASE_URL=${DATABASE_URL:-postgres://app_user:app_password@localhost:5432/saas_db}

TENANT_SERVICE_URL=${TENANT_SERVICE_URL:-http://tenant-service.internal.serverless-saas-platform-localdev:3001}
USER_SERVICE_URL=${USER_SERVICE_URL:-http://user-service.internal.serverless-saas-platform-localdev:3002}
BILLING_SERVICE_URL=${BILLING_SERVICE_URL:-http://billing-service.internal.serverless-saas-platform-localdev:3003}
FILE_SERVICE_URL=${FILE_SERVICE_URL:-http://file-service.internal.serverless-saas-platform-localdev:3004}
INTERNAL_SERVICE_TOKEN=${INTERNAL_SERVICE_TOKEN:-internal_dev_token}
EOF
      ;;

    billing-service)
      cat <<EOF > "$SERVICE/.env"
NODE_ENV=${NODE_ENV:-production}
PORT=${PORT:-3000}

JWT_SECRET=${JWT_SECRET:-replace-me-in-prod}
REDIS_URL=${REDIS_URL:-redis://localhost:6379}
DB_PASSWORD=${DB_PASSWORD:-app_password}
DATABASE_URL=${DATABASE_URL:-postgres://app_user:app_password@localhost:5432/saas_db}

FRONTEND_URL=${FRONTEND_URL:-http://localhost:3000}
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-sk_test_replace_me}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:-whsec_replace_me}
INTERNAL_SERVICE_TOKEN=${INTERNAL_SERVICE_TOKEN:-internal_dev_token}
EOF
      ;;

    file-service)
      cat <<EOF > "$SERVICE/.env"
NODE_ENV=${NODE_ENV:-production}
PORT=${PORT:-3000}

JWT_SECRET=${JWT_SECRET:-replace-me-in-prod}
REDIS_URL=${REDIS_URL:-redis://localhost:6379}
DB_PASSWORD=${DB_PASSWORD:-app_password}
DATABASE_URL=${DATABASE_URL:-postgres://app_user:app_password@localhost:5432/saas_db}

MINIO_ENDPOINT=${MINIO_ENDPOINT:-localhost}
MINIO_PORT=${MINIO_PORT:-9000}
MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY:-minioadmin}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY:-minioadmin}
MINIO_BUCKET=${MINIO_BUCKET:-uploads}
INTERNAL_SERVICE_TOKEN=${INTERNAL_SERVICE_TOKEN:-internal_dev_token}
EOF
      ;;

    worker-service)
      cat <<EOF > "$SERVICE/.env"
NODE_ENV=${NODE_ENV:-production}

REDIS_URL=${REDIS_URL:-redis://localhost:6379}
DB_PASSWORD=${DB_PASSWORD:-app_password}
DATABASE_URL=${DATABASE_URL:-postgres://app_user:app_password@localhost:5432/saas_db}
INTERNAL_SERVICE_TOKEN=${INTERNAL_SERVICE_TOKEN:-internal_dev_token}
EOF
      ;;

    *)
      cat <<EOF > "$SERVICE/.env"
NODE_ENV=${NODE_ENV:-production}
PORT=${PORT:-3000}

JWT_SECRET=${JWT_SECRET:-replace-me-in-prod}
REDIS_URL=${REDIS_URL:-redis://localhost:6379}
DB_PASSWORD=${DB_PASSWORD:-app_password}
DATABASE_URL=${DATABASE_URL:-postgres://app_user:app_password@localhost:5432/saas_db}
INTERNAL_SERVICE_TOKEN=${INTERNAL_SERVICE_TOKEN:-internal_dev_token}
EOF
      ;;
  esac
done

echo "✅ .env files generated"