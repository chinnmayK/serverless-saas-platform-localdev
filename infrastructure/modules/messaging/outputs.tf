output "customer_created_queue_url" {
  value = aws_sqs_queue.customer_created.id
}

output "event_bus_name" {
  value = aws_cloudwatch_event_bus.microservices_bus.name
}

output "order_created_queue_url" {
  value = aws_sqs_queue.order_created.id
}

output "order_created_products_queue_url" {
  value = aws_sqs_queue.order_created_products.id
}
