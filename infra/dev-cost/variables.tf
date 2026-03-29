variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev)"
  type        = string
  default     = "dev"
}

variable "aws_account_id" {
  description = "AWS account ID (used for IAM/budget ARNs)"
  type        = string
}

# ── Networking ────────────────────────────────────────────────────────────────

variable "vpc_id" {
  description = "VPC ID where the dev environment runs"
  type        = string
}

variable "public_subnet_id" {
  description = "Public subnet ID where the NAT instance will be launched"
  type        = string
}

variable "private_rt_id" {
  description = "Private route table ID whose default route should point to the NAT instance"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
  default     = []
}

# ── EC2 NAT Instance ──────────────────────────────────────────────────────────

variable "key_name" {
  description = "EC2 key pair name for SSH access to the NAT instance (optional)"
  type        = string
  default     = ""
}

# ── RDS ───────────────────────────────────────────────────────────────────────

variable "db_subnet_group_name" {
  description = "RDS subnet group name"
  type        = string
  default     = ""
}

variable "db_password" {
  description = "RDS master password (supply via TF_VAR_db_password or tfvars, never hardcode)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "manage_rds" {
  description = "Set to true to manage the dev RDS instance via this module (false = skip if not using RDS)"
  type        = bool
  default     = false
}

# ── ECS ───────────────────────────────────────────────────────────────────────

variable "ecs_cluster_name" {
  description = "Name of the ECS cluster to attach Fargate Spot capacity providers to"
  type        = string
  default     = "afrisend-dev"
}

variable "ecs_service_name" {
  description = "ECS service name to update with Fargate Spot strategy"
  type        = string
  default     = "afrisend-backend"
}

variable "task_definition_arn" {
  description = "ECS task definition ARN for the dev service"
  type        = string
  default     = ""
}

variable "ecs_sg_id" {
  description = "Security group ID for ECS tasks"
  type        = string
  default     = ""
}

variable "manage_ecs" {
  description = "Set to true to manage ECS cluster/service capacity providers via this module"
  type        = bool
  default     = false
}

# ── Budgets & Notifications ───────────────────────────────────────────────────

variable "notification_email" {
  description = "Email address to receive AWS Budget alerts"
  type        = string
}
