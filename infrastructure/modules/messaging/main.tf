########################################################
# SQS DEAD LETTER QUEUE — CUSTOMERS
########################################################

resource "aws_sqs_queue" "customer_created_dlq" {
  name                    = "${var.project_name}-customer-created-dlq"
  sqs_managed_sse_enabled = true
}

########################################################
# MAIN SQS QUEUE — CUSTOMERS
########################################################

resource "aws_sqs_queue" "customer_created" {
  name                       = "${var.project_name}-customer-created-queue"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.customer_created_dlq.arn
    maxReceiveCount     = 3
  })
}

########################################################
# SQS DEAD LETTER QUEUE — ORDERS
########################################################

resource "aws_sqs_queue" "order_created_dlq" {
  name                    = "${var.project_name}-order-created-dlq"
  sqs_managed_sse_enabled = true
}

########################################################
# MAIN SQS QUEUE — ORDERS
########################################################

resource "aws_sqs_queue" "order_created" {
  name                       = "${var.project_name}-order-created-queue"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.order_created_dlq.arn
    maxReceiveCount     = 3
  })
}

########################################################
# SQS DEAD LETTER QUEUE — PRODUCTS (OrderCreated)
########################################################

resource "aws_sqs_queue" "order_created_products_dlq" {
  name                    = "${var.project_name}-order-created-products-dlq"
  sqs_managed_sse_enabled = true
}

########################################################
# MAIN SQS QUEUE — PRODUCTS (OrderCreated)
########################################################

resource "aws_sqs_queue" "order_created_products" {
  name                       = "${var.project_name}-order-created-products-queue"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.order_created_products_dlq.arn
    maxReceiveCount     = 3
  })
}

########################################################
# SQS DEAD LETTER QUEUE — CACHE INVALIDATED
########################################################

resource "aws_sqs_queue" "cache_invalidated_dlq" {
  name                    = "${var.project_name}-cache-invalidated-dlq"
  sqs_managed_sse_enabled = true
}

########################################################
# MAIN SQS QUEUE — CACHE INVALIDATED
########################################################

resource "aws_sqs_queue" "cache_invalidated_queue" {
  name                       = "${var.project_name}-cache-invalidated-queue"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.cache_invalidated_dlq.arn
    maxReceiveCount     = 3
  })
}

########################################################
# EVENTBRIDGE BUS
########################################################

resource "aws_cloudwatch_event_bus" "microservices_bus" {
  name = "${var.project_name}-bus"
}

########################################################
# EVENT RULE
########################################################

resource "aws_cloudwatch_event_rule" "customer_created_rule" {
  name           = "${var.project_name}-customer-created-rule"
  event_bus_name = aws_cloudwatch_event_bus.microservices_bus.name

  event_pattern = jsonencode({
    source      = ["customer.service"]
    detail-type = ["CustomerCreated"]
  })
}

resource "aws_cloudwatch_event_rule" "order_created_rule" {
  name           = "${var.project_name}-order-created-rule"
  event_bus_name = aws_cloudwatch_event_bus.microservices_bus.name

  event_pattern = jsonencode({
    source      = ["shopping.service"]
    detail-type = ["OrderCreated"]
  })
}

########################################################
# EVENT RULE — CACHE INVALIDATED
########################################################

resource "aws_cloudwatch_event_rule" "cache_invalidated_rule" {
  name           = "${var.project_name}-cache-invalidated-rule"
  description    = "Cache invalidation events"
  event_bus_name = aws_cloudwatch_event_bus.microservices_bus.name

  event_pattern = jsonencode({
    source      = ["products.service"]
    detail-type = ["CacheInvalidated"]
  })
}

########################################################
# EVENT TARGET → SQS
########################################################

resource "aws_cloudwatch_event_target" "sqs_customer_target" {
  rule           = aws_cloudwatch_event_rule.customer_created_rule.name
  event_bus_name = aws_cloudwatch_event_bus.microservices_bus.name
  arn            = aws_sqs_queue.customer_created.arn

  depends_on = [
    aws_sqs_queue_policy.allow_eventbridge_customer_created
  ]
}

resource "aws_cloudwatch_event_target" "sqs_order_target" {
  rule           = aws_cloudwatch_event_rule.order_created_rule.name
  event_bus_name = aws_cloudwatch_event_bus.microservices_bus.name
  arn            = aws_sqs_queue.order_created.arn

  depends_on = [
    aws_sqs_queue_policy.allow_eventbridge_order_created
  ]
}

# Fan-out: OrderCreated also delivers to the Products queue
resource "aws_cloudwatch_event_target" "sqs_order_products_target" {
  rule           = aws_cloudwatch_event_rule.order_created_rule.name
  event_bus_name = aws_cloudwatch_event_bus.microservices_bus.name
  target_id      = "OrderCreatedProductsTarget"
  arn            = aws_sqs_queue.order_created_products.arn

  depends_on = [
    aws_sqs_queue_policy.allow_eventbridge_order_created_products
  ]
}

resource "aws_cloudwatch_event_target" "cache_invalidated_target" {
  rule           = aws_cloudwatch_event_rule.cache_invalidated_rule.name
  event_bus_name = aws_cloudwatch_event_bus.microservices_bus.name
  target_id      = "CacheInvalidatedQueue"
  arn            = aws_sqs_queue.cache_invalidated_queue.arn

  depends_on = [
    aws_sqs_queue_policy.allow_eventbridge_cache_invalidated
  ]
}

########################################################
# ALLOW EVENTBRIDGE TO SEND TO SQS
########################################################

resource "aws_sqs_queue_policy" "allow_eventbridge_customer_created" {
  queue_url = aws_sqs_queue.customer_created.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.customer_created.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.customer_created_rule.arn
          }
        }
      }
    ]
  })
}

resource "aws_sqs_queue_policy" "allow_eventbridge_order_created" {
  queue_url = aws_sqs_queue.order_created.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.order_created.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.order_created_rule.arn
          }
        }
      }
    ]
  })
}

resource "aws_sqs_queue_policy" "allow_eventbridge_order_created_products" {
  queue_url = aws_sqs_queue.order_created_products.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.order_created_products.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.order_created_rule.arn
          }
        }
      }
    ]
  })
}

resource "aws_sqs_queue_policy" "allow_eventbridge_cache_invalidated" {
  queue_url = aws_sqs_queue.cache_invalidated_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.cache_invalidated_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.cache_invalidated_rule.arn
          }
        }
      }
    ]
  })
}

########################################################
# SNS — ALERTS TOPIC & EMAIL SUBSCRIPTION
########################################################

resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts-topic"
}

resource "aws_sns_topic_subscription" "email_alerts" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.email
}

########################################################
# CLOUDWATCH ALARMS
########################################################

# DLQ alarms use evaluation_periods=1 — any dead letter is immediately actionable

# --- Customer DLQ ---
resource "aws_cloudwatch_metric_alarm" "dlq_alarm" {
  alarm_name          = "${var.project_name}-customer-dlq-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Messages stuck in customer_created DLQ — processing failures detected"

  dimensions = {
    QueueName = aws_sqs_queue.customer_created_dlq.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# --- Order DLQ ---
resource "aws_cloudwatch_metric_alarm" "order_dlq_alarm" {
  alarm_name          = "${var.project_name}-order-dlq-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Messages stuck in order_created DLQ — processing failures detected"

  dimensions = {
    QueueName = aws_sqs_queue.order_created_dlq.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# Backlog & age alarms use 2-of-3 datapoints to avoid alert fatigue on transient spikes

# --- Customer Queue Backlog ---
resource "aws_cloudwatch_metric_alarm" "customer_queue_backlog_alarm" {
  alarm_name          = "${var.project_name}-customer-queue-backlog-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Average"
  threshold           = 50
  alarm_description   = "Customer queue backlog exceeds 50 messages — consumers may be lagging"

  dimensions = {
    QueueName = aws_sqs_queue.customer_created.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# --- Order Queue Backlog ---
resource "aws_cloudwatch_metric_alarm" "order_queue_backlog_alarm" {
  alarm_name          = "${var.project_name}-order-queue-backlog-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Average"
  threshold           = 50
  alarm_description   = "Order queue backlog exceeds 50 messages — consumers may be lagging"

  dimensions = {
    QueueName = aws_sqs_queue.order_created.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# --- Customer Queue — Age of Oldest Message ---
resource "aws_cloudwatch_metric_alarm" "customer_queue_age_alarm" {
  alarm_name          = "${var.project_name}-customer-queue-age-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 300 # seconds — alert if a message is stuck for >5 min
  alarm_description   = "Customer queue has a message older than 5 min — processing may be stalled"

  dimensions = {
    QueueName = aws_sqs_queue.customer_created.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# --- Order Queue — Age of Oldest Message ---
resource "aws_cloudwatch_metric_alarm" "order_queue_age_alarm" {
  alarm_name          = "${var.project_name}-order-queue-age-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 300 # seconds — alert if a message is stuck for >5 min
  alarm_description   = "Order queue has a message older than 5 min — processing may be stalled"

  dimensions = {
    QueueName = aws_sqs_queue.order_created.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}
