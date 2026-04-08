variable "project_name" {}
variable "vpc_id" {}
variable "private_subnet_ids" {
  type = list(string)
}
variable "security_group_id" {
  description = "Security group ID of the ECS tasks (to allow access)"
}
variable "db_password" {}
