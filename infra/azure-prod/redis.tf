# ─── Azure Cache for Redis (~$16/mo with Basic C0) ───────────────────────────

resource "azurerm_redis_cache" "main" {
  name                          = "redis-${local.resource_prefix}"
  location                      = azurerm_resource_group.main.location
  resource_group_name           = azurerm_resource_group.main.name
  capacity                      = var.redis_capacity
  family                        = var.redis_family
  sku_name                      = var.redis_sku
  non_ssl_port_enabled          = false
  minimum_tls_version           = "1.2"
  public_network_access_enabled = true

  redis_configuration {
    maxmemory_policy = "allkeys-lru"
  }

  tags = local.tags
}
