output "codestar_connection_arn" {
  description = "The ARN of the CodeStar Connection"
  value       = aws_codestarconnections_connection.github.arn
}
