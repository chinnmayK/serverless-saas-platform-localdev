############################################################
# RANDOM JWT SECRET
############################################################

resource "random_password" "jwt_secret" {
  length  = 32
  special = false
}

############################################################
# APP SECRETS (SINGLE SECRET - CLEAN DESIGN)
############################################################

resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${var.project_name}-app-secrets"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "app_secrets_value" {
  secret_id = aws_secretsmanager_secret.app_secrets.id

  secret_string = jsonencode({
    JWT_SECRET             = random_password.jwt_secret.result
    REDIS_URL              = var.redis_endpoint
    DB_PASSWORD            = var.db_password
    DATABASE_URL           = "postgresql://app_user:${var.db_password}@${var.db_endpoint}:5432/saas_db"
    INTERNAL_SERVICE_TOKEN = var.internal_service_token
    FRONTEND_URL           = var.frontend_url
    STRIPE_SECRET_KEY      = var.stripe_secret_key
    STRIPE_WEBHOOK_SECRET  = var.stripe_webhook_secret
    MINIO_ENDPOINT         = var.minio_endpoint
    MINIO_PORT             = var.minio_port
    MINIO_ACCESS_KEY       = var.minio_access_key
    MINIO_SECRET_KEY       = var.minio_secret_key
    MINIO_BUCKET           = var.minio_bucket
  })
}
