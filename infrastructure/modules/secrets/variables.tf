variable "project_name" {}
variable "redis_endpoint" {}
variable "db_password" {}
variable "db_endpoint" {}
variable "aws_region" {
  type    = string
  default = "ap-south-1"
}
variable "internal_service_token" {
  type    = string
  default = "internal-secret"
}
variable "frontend_url" {
  type    = string
  default = "http://example.com"
}
variable "stripe_secret_key" {
  type    = string
  default = "sk_test_xxx"
}
variable "stripe_webhook_secret" {
  type    = string
  default = "whsec_xxx"
}
variable "s3_bucket" {
  type        = string
  description = "S3 bucket name for file uploads"
}
