output "postgres_endpoint" {
  description = "The PostgreSQL database hostname (address only, no port)"
  value       = aws_db_instance.main.address
}

output "postgres_sg_id" {
  description = "Security group ID for the PostgreSQL instance"
  value       = aws_security_group.postgres_sg.id
}
