# ─── Outputs ──────────────────────────────────────────────────────────────────

output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "vm_name" {
  description = "Name of the Virtual Machine"
  value       = azurerm_linux_virtual_machine.main.name
}

output "vm_public_ip" {
  description = "Public IP address of the VM — use for SSH and QA access"
  value       = azurerm_public_ip.main.ip_address
}

output "vm_admin_username" {
  description = "Admin username for SSH access"
  value       = var.vm_admin_username
}

output "kong_proxy_url" {
  description = "Kong proxy URL — all API traffic flows through here"
  value       = "http://${azurerm_public_ip.main.ip_address}:8000"
}

output "grafana_url" {
  description = "Grafana dashboard URL"
  value       = "http://${azurerm_public_ip.main.ip_address}:3001"
}

output "prometheus_url" {
  description = "Prometheus URL"
  value       = "http://${azurerm_public_ip.main.ip_address}:9090"
}

output "ssh_command" {
  description = "SSH command to connect to the VM"
  value       = "ssh ${var.vm_admin_username}@${azurerm_public_ip.main.ip_address}"
}

# ─── Cost Estimate ────────────────────────────────────────────────────────────
# Standard_B2s VM (2 vCPU, 4 GiB RAM):  ~$30-35/mo (Linux, East US)
# Premium_LRS OS disk (64 GiB):          ~$10/mo
# Public IP (Static, Standard):          ~$4/mo
# ─── Total Estimate:                    ~$44-49/mo ───────────────────────────
