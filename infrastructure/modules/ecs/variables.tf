variable "project_name" {}
variable "aws_region" {}

variable "vpc_id" {}
variable "public_subnet_ids" {
  type = list(string)
}
variable "private_subnet_ids" {}
variable "security_group_id" {}
variable "alb_security_group_id" {}

variable "execution_role_arn" {}
variable "task_role_arn" {}

variable "api_gateway_image" {}
variable "user_service_image" {}
variable "tenant_service_image" {}
variable "billing_service_image" {}
variable "file_service_image" {}
variable "app_secrets_arn" {}
