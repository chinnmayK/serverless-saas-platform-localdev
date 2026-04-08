output "endpoint" {
  description = "The DocumentDB cluster endpoint"
  value       = aws_docdb_cluster.main.endpoint
}

output "cluster_id" {
  value = aws_docdb_cluster.main.cluster_identifier
}

output "security_group_id" {
  value = aws_security_group.docdb_sg.id
}
