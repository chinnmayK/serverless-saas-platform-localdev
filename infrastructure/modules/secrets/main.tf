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
    JWT_SECRET   = random_password.jwt_secret.result
    REDIS_URL    = var.redis_endpoint
    DB_PASSWORD  = var.db_password
    DATABASE_URL = "mongodb://docdbadmin:${var.db_password}@${var.db_endpoint}:27017/?tls=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false"
  })
}
