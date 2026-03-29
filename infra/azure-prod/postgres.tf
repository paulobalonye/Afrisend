# ─── PostgreSQL Flexible Server (~$13/mo with B1ms) ──────────────────────────

resource "azurerm_postgresql_flexible_server" "main" {
  name                          = "psql-${local.resource_prefix}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  version                       = var.postgres_version
  administrator_login           = "afrisend_admin"
  administrator_password        = random_password.postgres.result
  sku_name                      = var.postgres_sku
  storage_mb                    = var.postgres_storage_mb
  backup_retention_days         = 7
  geo_redundant_backup_enabled  = false
  public_network_access_enabled = true
  zone                          = "1"

  authentication {
    active_directory_auth_enabled = false
    password_auth_enabled         = true
  }

  tags = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = "afrisend_prod"
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "utf8"
  collation = "en_US.utf8"
}

# Allow Azure services to connect (Container Apps)
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}
