output "endpoint" {
  description = "The PostgreSQL database endpoint"
  value       = aws_db_instance.main.endpoint
}

output "instance_id" {
  value = aws_db_instance.main.id
}

output "security_group_id" {
  value = aws_security_group.postgres_sg.id
}
