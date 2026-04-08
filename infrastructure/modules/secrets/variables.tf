variable "project_name" {}
variable "redis_endpoint" {}
variable "db_password" {}
variable "db_endpoint" {}
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
variable "minio_endpoint" {
  type    = string
  default = "minio"
}
variable "minio_port" {
  type    = string
  default = "9000"
}
variable "minio_access_key" {
  type    = string
  default = "minio"
}
variable "minio_secret_key" {
  type    = string
  default = "minio123"
}
variable "minio_bucket" {
  type    = string
  default = "files"
}
