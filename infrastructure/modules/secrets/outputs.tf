output "mongo_secret_arn" {
  value = aws_secretsmanager_secret.mongo_secret.arn
}

output "jwt_secret_arn" {
  value = aws_secretsmanager_secret.jwt_secret.arn
}
