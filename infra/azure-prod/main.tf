# ─── Resource Group ────────────────────────────────────────────────────────────

resource "azurerm_resource_group" "main" {
  name     = "rg-${var.project_name}-${var.environment}"
  location = var.location

  tags = local.tags
}

# ─── Locals ───────────────────────────────────────────────────────────────────

locals {
  tags = {
    project     = var.project_name
    environment = var.environment
    managed_by  = "terraform"
  }

  resource_prefix = "${var.project_name}-${var.environment}"
}

# ─── Random Password for PostgreSQL ──────────────────────────────────────────

resource "random_password" "postgres" {
  length           = 32
  special          = true
  override_special = "!@#$%"
  min_lower        = 4
  min_upper        = 4
  min_numeric      = 4
  min_special      = 2
}

# ─── Log Analytics Workspace (required for Container Apps) ────────────────────

resource "azurerm_log_analytics_workspace" "main" {
  name                = "law-${local.resource_prefix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = local.tags
}
