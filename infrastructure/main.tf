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
# DOCUMENTDB MODULE
########################################################

module "documentdb" {
  source = "./modules/documentdb"

  project_name       = var.project_name
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  security_group_id  = module.network.security_group_id
  db_password        = random_password.db_password.result
}

########################################################
# SECRETS MODULE
########################################################

module "secrets" {
  source       = "./modules/secrets"
  project_name = var.project_name

  db_password    = random_password.db_password.result
  redis_endpoint = module.network.redis_endpoint
  db_endpoint    = module.documentdb.endpoint
}

########################################################
# ECS FARGATE MODULE (NEW - IMPORTANT)
########################################################

module "ecs" {
  source = "./modules/ecs"

  project_name          = var.project_name
  aws_region            = var.aws_region
  vpc_id                = module.network.vpc_id
  public_subnet_ids     = module.network.public_subnet_ids
  private_subnet_ids    = module.network.private_subnet_ids
  security_group_id     = module.network.security_group_id
  alb_security_group_id = module.network.alb_security_group_id

  # ECR repositories (from ecr module)
  api_gateway_image     = module.ecr.api_gateway_repo_url
  user_service_image    = module.ecr.user_service_repo_url
  tenant_service_image  = module.ecr.tenant_service_repo_url
  billing_service_image = module.ecr.billing_service_repo_url
  file_service_image    = module.ecr.file_service_repo_url

  # IAM roles
  execution_role_arn = module.iam.ecs_execution_role_arn
  task_role_arn      = module.iam.ecs_task_role_arn
  app_secrets_arn    = module.secrets.app_secrets_arn

  depends_on = [
    module.ecr,
    module.network,
    module.iam
  ]
}

# Explicit ECS connectivity validation for DocumentDB and Redis.
# This creates explicit cross-security-group egress rules in addition to the
# existing inbound rules on the target resources.
resource "aws_security_group_rule" "ecs_to_docdb" {
  type                     = "egress"
  from_port                = 27017
  to_port                  = 27017
  protocol                 = "tcp"
  security_group_id        = module.network.security_group_id
  source_security_group_id = module.documentdb.security_group_id
  description              = "Allow ECS tasks to reach DocumentDB"
}

resource "aws_security_group_rule" "ecs_to_redis" {
  type                     = "egress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  security_group_id        = module.network.security_group_id
  source_security_group_id = module.network.redis_security_group_id
  description              = "Allow ECS tasks to reach Redis"
}
