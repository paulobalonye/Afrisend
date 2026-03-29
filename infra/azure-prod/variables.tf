# ─── General ──────────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "afrisend"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "eastus"
}

# ─── Container App ────────────────────────────────────────────────────────────

variable "container_image" {
  description = "Docker image to deploy (e.g. ghcr.io/paulobalonye/afrisend-api:latest)"
  type        = string
}

variable "container_cpu" {
  description = "CPU cores for the container app"
  type        = number
  default     = 0.5
}

variable "container_memory" {
  description = "Memory in Gi for the container app"
  type        = string
  default     = "1Gi"
}

variable "container_min_replicas" {
  description = "Minimum number of container replicas"
  type        = number
  default     = 1
}

variable "container_max_replicas" {
  description = "Maximum number of container replicas"
  type        = number
  default     = 3
}

# ─── PostgreSQL ───────────────────────────────────────────────────────────────

variable "postgres_sku" {
  description = "PostgreSQL Flexible Server SKU"
  type        = string
  default     = "B_Standard_B1ms"
}

variable "postgres_storage_mb" {
  description = "PostgreSQL storage in MB"
  type        = number
  default     = 32768
}

variable "postgres_version" {
  description = "PostgreSQL major version"
  type        = string
  default     = "15"
}

# ─── Redis ────────────────────────────────────────────────────────────────────

variable "redis_sku" {
  description = "Redis Cache SKU (Basic, Standard, Premium)"
  type        = string
  default     = "Basic"
}

variable "redis_capacity" {
  description = "Redis Cache capacity (0 = 250MB for Basic)"
  type        = number
  default     = 0
}

variable "redis_family" {
  description = "Redis Cache family (C for Basic/Standard)"
  type        = string
  default     = "C"
}

# ─── Custom Domain ────────────────────────────────────────────────────────────

variable "custom_domain" {
  description = "Custom domain for the API (leave empty to skip)"
  type        = string
  default     = ""
}

# ─── App Environment Variables ────────────────────────────────────────────────

variable "yellowcard_base_url" {
  description = "YellowCard API base URL (use https://api.yellowcard.io for production)"
  type        = string
  default     = "https://api.yellowcard.io"
}
