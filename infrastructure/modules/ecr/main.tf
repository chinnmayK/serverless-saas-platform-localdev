############################################################
# SERVICES LIST (UPDATED FOR SAAS)
############################################################

locals {
  services = [
    "api-gateway",
    "user-service",
    "tenant-service",
    "billing-service",
    "file-service"
  ]
}

############################################################
# ECR REPOSITORIES
############################################################

resource "aws_ecr_repository" "repos" {
  for_each = toset(local.services)

  name         = "${var.project_name}-${each.key}"
  force_delete = true

  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name = "${var.project_name}-${each.key}"
  }
}

############################################################
# LIFECYCLE POLICY
############################################################

resource "aws_ecr_lifecycle_policy" "lifecycle" {
  for_each   = aws_ecr_repository.repos
  repository = each.value.name

  policy = jsonencode({
    rules = [

      {
        rulePriority = 1
        description  = "Expire untagged images"
        selection = {
          tagStatus   = "untagged"
          countType   = "imageCountMoreThan"
          countNumber = 1
        }
        action = {
          type = "expire"
        }
      },

      {
        rulePriority = 2
        description  = "Keep last 10 latest images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["latest"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
