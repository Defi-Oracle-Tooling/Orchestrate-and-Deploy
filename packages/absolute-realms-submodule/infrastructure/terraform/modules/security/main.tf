variable "resource_group_name" {
  description = "The name of the resource group"
  type        = string
}

variable "location" {
  description = "The Azure region where resources will be created"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "subnet_ids" {
  description = "List of subnet IDs to allow access to the Key Vault"
  type        = list(string)
  default     = []
}

variable "tenant_id" {
  description = "The Azure tenant ID"
  type        = string
}

locals {
  base_name          = "absoluterealms"
  key_vault_name     = "${local.base_name}-kv-${var.environment}-${substr(md5(var.resource_group_name), 0, 8)}"
  user_identity_name = "${local.base_name}-id-${var.environment}-${substr(md5(var.resource_group_name), 0, 8)}"

  common_tags = merge({
    Environment = var.environment
    Project     = "Absolute Realms"
    ManagedBy   = "Terraform"
    Module      = "Security"
  }, var.tags)
}

# User Assigned Managed Identity
resource "azurerm_user_assigned_identity" "main" {
  name                = local.user_identity_name
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = local.common_tags
}

# Key Vault with enhanced security
resource "azurerm_key_vault" "main" {
  name                       = local.key_vault_name
  resource_group_name        = var.resource_group_name
  location                   = var.location
  tenant_id                  = var.tenant_id
  soft_delete_retention_days = 90
  purge_protection_enabled   = true
  sku_name                   = "standard"

  # By default, only allow access through private networks and Azure services
  network_acls {
    default_action             = "Deny"
    bypass                     = "AzureServices"
    virtual_network_subnet_ids = var.subnet_ids
  }

  tags = local.common_tags
}

# Key Vault Access Policy for Managed Identity
resource "azurerm_key_vault_access_policy" "managed_identity" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = var.tenant_id
  object_id    = azurerm_user_assigned_identity.main.principal_id

  secret_permissions = [
    "Get",
    "List",
    "Set"
  ]

  key_permissions = [
    "Get",
    "List",
    "Create"
  ]

  certificate_permissions = [
    "Get",
    "List"
  ]
}

# Private Endpoint for secure access to Key Vault
resource "azurerm_private_endpoint" "key_vault" {
  count               = length(var.subnet_ids) > 0 ? 1 : 0
  name                = "${local.key_vault_name}-pe"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.subnet_ids[0]

  private_service_connection {
    name                           = "${local.key_vault_name}-connection"
    private_connection_resource_id = azurerm_key_vault.main.id
    is_manual_connection           = false
    subresource_names              = ["vault"]
  }

  tags = local.common_tags
}

# Default Key Vault Diagnostic Settings
resource "azurerm_monitor_diagnostic_setting" "key_vault" {
  name                       = "${local.key_vault_name}-diag"
  target_resource_id         = azurerm_key_vault.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  log {
    category = "AuditEvent"
    enabled  = true
    retention_policy {
      enabled = true
      days    = 30
    }
  }

  log {
    category = "AzurePolicyEvaluationDetails"
    enabled  = true
    retention_policy {
      enabled = true
      days    = 30
    }
  }

  metric {
    category = "AllMetrics"
    enabled  = true
    retention_policy {
      enabled = true
      days    = 30
    }
  }
}

# Log Analytics Workspace for security monitoring
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${local.base_name}-law-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = local.common_tags
}

# Outputs
output "key_vault_id" {
  description = "ID of the Key Vault"
  value       = azurerm_key_vault.main.id
}

output "key_vault_uri" {
  description = "URI of the Key Vault"
  value       = azurerm_key_vault.main.vault_uri
}

output "key_vault_name" {
  description = "Name of the Key Vault"
  value       = azurerm_key_vault.main.name
}

output "user_identity_id" {
  description = "ID of the User Assigned Managed Identity"
  value       = azurerm_user_assigned_identity.main.id
}

output "user_identity_principal_id" {
  description = "Principal ID of the User Assigned Managed Identity"
  value       = azurerm_user_assigned_identity.main.principal_id
}

output "user_identity_client_id" {
  description = "Client ID of the User Assigned Managed Identity"
  value       = azurerm_user_assigned_identity.main.client_id
}

output "log_analytics_workspace_id" {
  description = "ID of the Log Analytics Workspace"
  value       = azurerm_log_analytics_workspace.main.id
}
