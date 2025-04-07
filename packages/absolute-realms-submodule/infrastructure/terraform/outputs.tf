output "function_app_url" {
  description = "The URL of the deployed Azure Function App"
  value       = "https://${azurerm_function_app.main.default_hostname}"
}

output "static_web_app_url" {
  description = "The URL of the deployed Static Web App"
  value       = azurerm_static_site.main.default_host_name
}

output "key_vault_url" {
  description = "The URL of the Azure Key Vault"
  value       = azurerm_key_vault.main.vault_uri
}

output "resource_group_id" {
  description = "The ID of the resource group where resources are deployed"
  value       = data.azurerm_resource_group.main.id
}

output "application_insights_instrumentation_key" {
  description = "The instrumentation key for Application Insights"
  value       = azurerm_application_insights.main.instrumentation_key
  sensitive   = true
}

output "managed_identity_client_id" {
  description = "The client ID of the created user-assigned managed identity"
  value       = azurerm_user_assigned_identity.main.client_id
}

output "managed_identity_principal_id" {
  description = "The principal ID of the created user-assigned managed identity"
  value       = azurerm_user_assigned_identity.main.principal_id
}
