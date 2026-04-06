variable "project_name" {
  type = string
}

variable "redis_endpoint" {
  description = "Redis endpoint from network module"
  type        = string
}

variable "mongo_password" {
  description = "Master password for MongoDB/DocumentDB"
  type        = string
}
