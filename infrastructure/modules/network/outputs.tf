output "public_subnet_id" {
  value = aws_subnet.public.id
}

output "security_group_id" {
  value = aws_security_group.app_sg.id
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "private_subnet_ids" {
  description = "Private subnets for ECS"
  value       = [aws_subnet.private_1.id, aws_subnet.private_2.id]
}
