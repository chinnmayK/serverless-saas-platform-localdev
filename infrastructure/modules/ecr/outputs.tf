output "api_gateway_repo_url" {
  value = aws_ecr_repository.repos["api-gateway"].repository_url
}

output "user_service_repo_url" {
  value = aws_ecr_repository.repos["user-service"].repository_url
}

output "tenant_service_repo_url" {
  value = aws_ecr_repository.repos["tenant-service"].repository_url
}

output "billing_service_repo_url" {
  value = aws_ecr_repository.repos["billing-service"].repository_url
}

output "file_service_repo_url" {
  value = aws_ecr_repository.repos["file-service"].repository_url
}
