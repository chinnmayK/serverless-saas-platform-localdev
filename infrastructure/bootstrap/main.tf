# ------------------------------------------------------------
# Variables (from terraform.tfvars)
# ------------------------------------------------------------
variable "project_name" {}
variable "environment" {}
variable "aws_region" {}

# ------------------------------------------------------------
# AWS Provider
# ------------------------------------------------------------
provider "aws" {
  region = var.aws_region
}

# ------------------------------------------------------------
# Random suffix (for unique S3 bucket)
# ------------------------------------------------------------
resource "random_id" "suffix" {
  byte_length = 4
}

# ------------------------------------------------------------
# S3 Bucket for Terraform Remote State
# ------------------------------------------------------------
resource "aws_s3_bucket" "terraform_state" {
  bucket = "${var.project_name}-${var.environment}-tf-state-${random_id.suffix.hex}"
}

# ------------------------------------------------------------
# Enable Versioning (important for recovery)
# ------------------------------------------------------------
resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# ------------------------------------------------------------
# DynamoDB Table for State Locking
# ------------------------------------------------------------
resource "aws_dynamodb_table" "terraform_locks" {
  name         = "${var.project_name}-${var.environment}-tf-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}

# ------------------------------------------------------------
# Outputs
# ------------------------------------------------------------
output "terraform_state_bucket" {
  value = aws_s3_bucket.terraform_state.bucket
}

output "terraform_lock_table" {
  value = aws_dynamodb_table.terraform_locks.name
}