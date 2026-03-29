# ─── Azure Container Registry (~$5/mo with Basic) ────────────────────────────

resource "azurerm_container_registry" "main" {
  name                = "${var.project_name}${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = true

  tags = local.tags
}
