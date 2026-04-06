variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment (dev/staging/prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
}

variable "github_repo" {
  description = "GitHub repo owner/name"
  type        = string
}

variable "email" {
  description = "Email for alerts"
  type        = string
}
