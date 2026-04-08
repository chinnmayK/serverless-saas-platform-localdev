# Infrastructure Architecture & File Details

This document provides a comprehensive overview of the Terraform-managed infrastructure for the **Serverless SaaS Platform**.

## Table of Contents

- [Root Configuration](#root-configuration)
- [Bootstrap Infrastructure](#bootstrap-infrastructure)
- [Infrastructure Modules](#infrastructure-modules)
  - [Network Module (`modules/network`)](#network-module-modulesnetwork)
  - [IAM Module (`modules/iam`)](#iam-module-modulesiam)
  - [ECR Module (`modules/ecr`)](#ecr-module-modulesecr)
  - [CICD Module (`modules/cicd`)](#cicd-module-modulescicd)
  - [ECS Module (`modules/ecs`)](#ecs-module-modulesecs)
  - [DocumentDB Module (`modules/documentdb`)](#documentdb-module-modulesdocumentdb)
  - [Secrets Module (`modules/secrets`)](#secrets-module-modulessecrets)

---

## Root Configuration

The root directory orchestrates the various modules and defines the backend and providers.

| File | Description |
| :--- | :--- |
| [`main.tf`](file:///c:/Users/dell/serverless-saas-platform-localdev/infrastructure/main.tf) | Main entry point that calls all infrastructure modules (network, iam, ecr, cicd, documentdb, secrets, and ecs). |
| [`variables.tf`](file:///c:/Users/dell/serverless-saas-platform-localdev/infrastructure/variables.tf) | Global variable definitions (`project_name`, `environment`, `aws_region`, `github_repo`, `email`). |
| [`providers.tf`](file:///c:/Users/dell/serverless-saas-platform-localdev/infrastructure/providers.tf) | Configures AWS and Random providers. Defines S3 backend for remote state storage. |
| [`outputs.tf`](file:///c:/Users/dell/serverless-saas-platform-localdev/infrastructure/outputs.tf) | Root-level outputs including VPC ID, Redis endpoint, Private subnets, and ECR repository URLs. |
| [`terraform.tfvars`](file:///c:/Users/dell/serverless-saas-platform-localdev/infrastructure/terraform.tfvars) | Environment-specific variable values. |

---

## Bootstrap Infrastructure

Located in the [`/bootstrap`](file:///c:/Users/dell/serverless-saas-platform-localdev/infrastructure/bootstrap) directory, these resources are used to initialize the Terraform backend.

- **[`main.tf`](file:///c:/Users/dell/serverless-saas-platform-localdev/infrastructure/bootstrap/main.tf)**: Creates the S3 bucket for Terraform state and a DynamoDB table for state locking.

---

## Infrastructure Modules

### Network Module ([`modules/network`](file:///c:/Users/dell/serverless-saas-platform-localdev/infrastructure/modules/network))
Handles the core networking foundation.
- **Resources**: VPC, Internet Gateway, Public Subnet, Private Subnets (multi-AZ), NAT Gateway, Elastic IP, and Route Tables.
- **Additional**: Defines a Redis (ElastiCache) cluster within the private subnets.
- **Security**: Security Groups for application traffic (Ports 80, 3000) and Redis (Port 6379).

### IAM Module ([`modules/iam`](file:///c:/Users/dell/serverless-saas-platform-localdev/infrastructure/modules/iam))
Defines all AWS IAM roles and policies for the platform.
- **ECS Roles**: Task Execution Role (for pulling images/secrets) and Task Role (for app-level AWS permissions like SQS/EventBridge).
- **CI/CD Roles**: CodeBuild and CodePipeline service roles with necessary permissions (ECR, S3, ECS, SecretsManager).

### ECR Module ([`modules/ecr`](file:///c:/Users/dell/serverless-saas-platform-localdev/infrastructure/modules/ecr))
Manages Elastic Container Registry repositories.
- **Repositories**: `api-gateway`, `user-service`, `tenant-service`, `billing-service`, `file-service`.
- **Lifecycle Policies**: Configured to expire untagged images and keep the last 10 'latest' images.

### CICD Module ([`modules/cicd`](file:///c:/Users/dell/serverless-saas-platform-localdev/infrastructure/modules/cicd))
Implements the automated build and deployment pipeline.
- **Resources**: `aws_codestarconnections_connection` (GitHub connection), CodeBuild project (Linux container with Docker-in-Docker support), CodePipeline (Source and Build stages), and S3 bucket for artifacts.

### ECS Module ([`modules/ecs`](file:///c:/Users/dell/serverless-saas-platform-localdev/infrastructure/modules/ecs))
Manages the ECS Fargate cluster and services.
- **Resources**: ECS Cluster, CloudWatch Log Group for services.
- **Tasks**: For each service, it defines a Fargate Task Definition with memory/CPU limits, container mappings, logging, and secrets injection.
- **Services**: Manages the running tasks in private subnets without public IPs.

### DocumentDB Module ([`modules/documentdb`](file:///c:/Users/dell/serverless-saas-platform-localdev/infrastructure/modules/documentdb))
Provides a PostgreSQL RDS instance for the application.
- **Resources**: RDS PostgreSQL instance (`db.t3.micro`), DB Subnet Group, and Security Group (allowing 5432 from ECS).

### Secrets Module ([`modules/secrets`](file:///c:/Users/dell/serverless-saas-platform-localdev/infrastructure/modules/secrets))
Manages sensitive application data using AWS Secrets Manager.
- **Resources**: A single central secret (`${project_name}-app-secrets`) containing:
    - `JWT_SECRET` (Randomly generated)
    - `REDIS_URL`
    - `DB_PASSWORD`
    - `DATABASE_URL` (Full PostgreSQL connection string)

