########################################################
# ECS CLUSTER
########################################################

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"
}

########################################################
# CLOUDWATCH LOG GROUP
########################################################

resource "aws_cloudwatch_log_group" "ecs_logs" {
  name              = "/${var.project_name}/ecs"
  retention_in_days = 14
}

########################################################
# SERVICES MAP
########################################################

locals {
  services = {
    api-gateway     = var.api_gateway_image
    user-service    = var.user_service_image
    tenant-service  = var.tenant_service_image
    billing-service = var.billing_service_image
    file-service    = var.file_service_image
  }
}

########################################################
# TASK DEFINITIONS
########################################################

resource "aws_ecs_task_definition" "tasks" {
  for_each = local.services

  family                   = "${var.project_name}-${each.key}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"

  execution_role_arn = var.execution_role_arn
  task_role_arn      = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = each.key
      image     = "${each.value}:latest"
      essential = true

      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = "3000"
        }
      ]

      ##################################################
      # 🔥 Secrets from Secrets Manager
      ##################################################
      secrets = [
        {
          name      = "JWT_SECRET"
          valueFrom = "${var.app_secrets_arn}:JWT_SECRET::"
        },
        {
          name      = "REDIS_URL"
          valueFrom = "${var.app_secrets_arn}:REDIS_URL::"
        },
        {
          name      = "DB_PASSWORD"
          valueFrom = "${var.app_secrets_arn}:DB_PASSWORD::"
        },
        {
          name      = "DATABASE_URL"
          valueFrom = "${var.app_secrets_arn}:DATABASE_URL::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs_logs.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = each.key
        }
      }
    }
  ])

  depends_on = [aws_cloudwatch_log_group.ecs_logs]
}

########################################################
# ECS SERVICES
########################################################

resource "aws_ecs_service" "services" {
  for_each = aws_ecs_task_definition.tasks

  name            = "${var.project_name}-${each.key}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = each.value.arn
  launch_type     = "FARGATE"
  desired_count   = 1

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = false
  }

  depends_on = [
    aws_ecs_cluster.main,
    aws_ecs_task_definition.tasks
  ]
}
