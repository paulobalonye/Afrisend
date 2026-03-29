# ─── General ──────────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "afrisend"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "eastus"
}

# ─── VM ───────────────────────────────────────────────────────────────────────

variable "vm_size" {
  description = "Azure VM size — B2s (2 vCPU, 4 GiB RAM) is sufficient for Docker Compose dev"
  type        = string
  default     = "Standard_B2s"
}

variable "vm_admin_username" {
  description = "Admin username for the VM"
  type        = string
  default     = "azureuser"
}

variable "ssh_public_key" {
  description = "SSH public key for VM access (contents of ~/.ssh/id_rsa.pub or similar)"
  type        = string
}

variable "os_disk_size_gb" {
  description = "OS disk size in GiB — needs room for Docker images and volumes"
  type        = number
  default     = 64
}

# ─── Network ──────────────────────────────────────────────────────────────────

variable "allowed_ssh_cidrs" {
  description = "CIDR ranges allowed SSH access to the VM (restrict to your team's IPs)"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "allowed_http_cidrs" {
  description = "CIDR ranges allowed HTTP access (Kong proxy port 8000)"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}
