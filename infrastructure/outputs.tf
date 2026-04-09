output "postgres_endpoint" {
  description = "PostgreSQL RDS endpoint (hostname)"
  value       = module.postgres.postgres_endpoint
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.network.redis_endpoint
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.network.vpc_id
}

output "private_subnets" {
  description = "Private subnets for ECS"
  value       = module.network.private_subnet_ids
}

output "ecr_repositories" {
  description = "ECR repository URLs"
  value = {
    api_gateway     = module.ecr.api_gateway_repo_url
    user_service    = module.ecr.user_service_repo_url
    tenant_service  = module.ecr.tenant_service_repo_url
    billing_service = module.ecr.billing_service_repo_url
    file_service    = module.ecr.file_service_repo_url
  }
}
