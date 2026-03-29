# ─── Outputs ──────────────────────────────────────────────────────────────────

output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "container_app_url" {
  description = "FQDN of the Container App"
  value       = "https://${azurerm_container_app.api.ingress[0].fqdn}"
}

output "container_app_name" {
  description = "Name of the Container App"
  value       = azurerm_container_app.api.name
}

output "container_environment_name" {
  description = "Name of the Container Apps Environment"
  value       = azurerm_container_app_environment.main.name
}

output "postgres_fqdn" {
  description = "PostgreSQL server FQDN"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "postgres_database" {
  description = "PostgreSQL database name"
  value       = azurerm_postgresql_flexible_server_database.app.name
}

output "redis_hostname" {
  description = "Redis Cache hostname"
  value       = azurerm_redis_cache.main.hostname
}

output "redis_ssl_port" {
  description = "Redis Cache SSL port"
  value       = azurerm_redis_cache.main.ssl_port
}

output "log_analytics_workspace_id" {
  description = "Log Analytics Workspace ID for monitoring"
  value       = azurerm_log_analytics_workspace.main.id
}

# ─── Cost Estimate ────────────────────────────────────────────────────────────
# PostgreSQL Flexible Server B1ms:  ~$13/mo
# Redis Cache Basic C0:             ~$16/mo
# Container Apps (0.5 vCPU, 1Gi):   ~$10-15/mo (consumption pricing)
# Log Analytics (30-day retention):  ~$2-5/mo
# ─── Total Estimate:               ~$41-49/mo ────────────────────────────────
