# ------------------------------------------------------------
# Random Password (for DB / secrets)
# ------------------------------------------------------------
resource "random_password" "db_password" {
  length  = 20
  special = false
}

########################################################
# NETWORK MODULE
########################################################

module "network" {
  source       = "./modules/network"
  project_name = var.project_name
}

########################################################
# IAM MODULE
########################################################

module "iam" {
  source       = "./modules/iam"
  project_name = var.project_name
}

########################################################
# ECR MODULE
########################################################

module "ecr" {
  source       = "./modules/ecr"
  project_name = var.project_name
}

########################################################
# CICD MODULE
########################################################

module "cicd" {
  source = "./modules/cicd"

  project_name = var.project_name
  aws_region   = var.aws_region
  github_repo  = var.github_repo

  codebuild_role_arn    = module.iam.codebuild_role_arn
  codepipeline_role_arn = module.iam.codepipeline_role_arn
}

########################################################
# SECRETS MODULE
########################################################

module "secrets" {
  source       = "./modules/secrets"
  project_name = var.project_name

  # You will later map:
  mongo_password  = random_password.db_password.result
  redis_endpoint = module.network.redis_endpoint
}

########################################################
# MESSAGING MODULE (OPTIONAL - KEEP)
########################################################

module "messaging" {
  source       = "./modules/messaging"
  project_name = var.project_name
  email        = var.email
}

########################################################
# ECS FARGATE MODULE (NEW - IMPORTANT)
########################################################

module "ecs" {
  source = "./modules/ecs"

  project_name       = var.project_name
  aws_region         = var.aws_region
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  security_group_id  = module.network.security_group_id

  # ECR repositories (from ecr module)
  api_gateway_image     = module.ecr.api_gateway_repo_url
  user_service_image    = module.ecr.user_service_repo_url
  tenant_service_image  = module.ecr.tenant_service_repo_url
  billing_service_image = module.ecr.billing_service_repo_url
  file_service_image    = module.ecr.file_service_repo_url

  # IAM roles
  execution_role_arn = module.iam.ecs_execution_role_arn
  task_role_arn      = module.iam.ecs_task_role_arn

  depends_on = [
    module.ecr,
    module.network,
    module.iam
  ]
}
