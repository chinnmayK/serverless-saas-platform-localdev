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

  service_discovery_domain = "internal.${var.project_name}"
}

resource "aws_service_discovery_private_dns_namespace" "cloudmap" {
  name = local.service_discovery_domain
  vpc  = var.vpc_id
}

resource "aws_service_discovery_service" "cloudmap_services" {
  for_each = local.services

  name         = each.key
  namespace_id = aws_service_discovery_private_dns_namespace.cloudmap.id

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.cloudmap.id
    dns_records {
      type = "A"
      ttl  = 10
    }
    routing_policy = "MULTIVALUE"
  }
}

########################################################
# APPLICATION LOAD BALANCER
########################################################

resource "aws_lb" "alb" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids
}

resource "aws_lb_target_group" "api_gateway" {
  name_prefix = substr(var.project_name, 0, 6)
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.alb.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api_gateway.arn
  }

  lifecycle {
    create_before_destroy = true
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

      portMappings = each.key == "worker-service" ? [] : [
        {
          containerPort = 3000
          hostPort      = 3000
        }
      ]

      healthCheck = {
        command     = each.key == "worker-service" ? ["CMD-SHELL", "exit 0"] : ["CMD-SHELL", "node -e \"require('http').get('http://127.0.0.1:3000/health', (res) => process.exit(res.statusCode < 400 ? 0 : 1)).on('error', () => process.exit(1))\""]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = "3000"
        },
        {
          name  = "TENANT_SERVICE_URL"
          value = "http://tenant-service.${local.service_discovery_domain}:3001"
        },
        {
          name  = "USER_SERVICE_URL"
          value = "http://user-service.${local.service_discovery_domain}:3002"
        },
        {
          name  = "BILLING_SERVICE_URL"
          value = "http://billing-service.${local.service_discovery_domain}:3003"
        },
        {
          name  = "FILE_SERVICE_URL"
          value = "http://file-service.${local.service_discovery_domain}:3004"
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

  name                              = "${var.project_name}-${each.key}"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = each.value.arn
  launch_type                       = "FARGATE"
  desired_count                     = 1
  health_check_grace_period_seconds = 60

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = false
  }

  dynamic "load_balancer" {
    for_each = each.key == "api-gateway" ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.api_gateway.arn
      container_name   = each.key
      container_port   = 3000
    }
  }

  service_registries {
    registry_arn = aws_service_discovery_service.cloudmap_services[each.key].arn
  }

  depends_on = [
    aws_ecs_cluster.main,
    aws_ecs_task_definition.tasks,
    aws_lb_listener.http
  ]
}
