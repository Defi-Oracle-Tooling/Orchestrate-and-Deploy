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

variable "subnet_id" {
  description = "ID of the subnet for private endpoints"
  type        = string
}

variable "storage_account_id" {
  description = "ID of the storage account to create a private endpoint for"
  type        = string
}

variable "key_vault_id" {
  description = "ID of the Key Vault to create a private endpoint for"
  type        = string
}

variable "function_app_id" {
  description = "ID of the Function App to create a private endpoint for"
  type        = string
}

locals {
  base_name   = "absoluterealms"
  
  common_tags = merge({
    Environment = var.environment
    Project     = "Absolute Realms"
    ManagedBy   = "Terraform"
    Module      = "PrivateEndpoints"
  }, var.tags)
}

# Private DNS Zone for Storage Blob
resource "azurerm_private_dns_zone" "blob" {
  name                = "privatelink.blob.core.windows.net"
  resource_group_name = var.resource_group_name
  tags                = local.common_tags
}

# Private DNS Zone for Storage File
resource "azurerm_private_dns_zone" "file" {
  name                = "privatelink.file.core.windows.net"
  resource_group_name = var.resource_group_name
  tags                = local.common_tags
}

# Private DNS Zone for Key Vault
resource "azurerm_private_dns_zone" "vault" {
  name                = "privatelink.vaultcore.azure.net"
  resource_group_name = var.resource_group_name
  tags                = local.common_tags
}

# Private DNS Zone for Azure Functions
resource "azurerm_private_dns_zone" "functions" {
  name                = "privatelink.azurewebsites.net"
  resource_group_name = var.resource_group_name
  tags                = local.common_tags
}

# Private Endpoint for Storage Account - Blob
resource "azurerm_private_endpoint" "storage_blob" {
  name                = "${local.base_name}-pe-blob-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.subnet_id
  tags                = local.common_tags

  private_service_connection {
    name                           = "${local.base_name}-pe-blob-connection-${var.environment}"
    private_connection_resource_id = var.storage_account_id
    is_manual_connection           = false
    subresource_names              = ["blob"]
  }

  private_dns_zone_group {
    name                 = "blob-dns-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.blob.id]
  }
}

# Private Endpoint for Storage Account - File
resource "azurerm_private_endpoint" "storage_file" {
  name                = "${local.base_name}-pe-file-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.subnet_id
  tags                = local.common_tags

  private_service_connection {
    name                           = "${local.base_name}-pe-file-connection-${var.environment}"
    private_connection_resource_id = var.storage_account_id
    is_manual_connection           = false
    subresource_names              = ["file"]
  }

  private_dns_zone_group {
    name                 = "file-dns-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.file.id]
  }
}

# Private Endpoint for Key Vault
resource "azurerm_private_endpoint" "key_vault" {
  name                = "${local.base_name}-pe-kv-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.subnet_id
  tags                = local.common_tags

  private_service_connection {
    name                           = "${local.base_name}-pe-kv-connection-${var.environment}"
    private_connection_resource_id = var.key_vault_id
    is_manual_connection           = false
    subresource_names              = ["vault"]
  }

  private_dns_zone_group {
    name                 = "kv-dns-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.vault.id]
  }
}

# Private Endpoint for Function App
resource "azurerm_private_endpoint" "function_app" {
  name                = "${local.base_name}-pe-func-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.subnet_id
  tags                = local.common_tags

  private_service_connection {
    name                           = "${local.base_name}-pe-func-connection-${var.environment}"
    private_connection_resource_id = var.function_app_id
    is_manual_connection           = false
    subresource_names              = ["sites"]
  }

  private_dns_zone_group {
    name                 = "func-dns-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.functions.id]
  }
}

# Network Security Group for Private Endpoints Subnet
resource "azurerm_network_security_group" "pe_nsg" {
  name                = "${local.base_name}-pe-nsg-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = local.common_tags

  # Allow inbound traffic from VNet
  security_rule {
    name                       = "AllowVnetInBound"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "VirtualNetwork"
    destination_address_prefix = "VirtualNetwork"
  }

  # Deny all other inbound traffic
  security_rule {
    name                       = "DenyAllInBound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

# Outputs
output "blob_private_endpoint_id" {
  description = "ID of the Storage Blob Private Endpoint"
  value       = azurerm_private_endpoint.storage_blob.id
}

output "file_private_endpoint_id" {
  description = "ID of the Storage File Private Endpoint"
  value       = azurerm_private_endpoint.storage_file.id
}

output "key_vault_private_endpoint_id" {
  description = "ID of the Key Vault Private Endpoint"
  value       = azurerm_private_endpoint.key_vault.id
}

output "function_app_private_endpoint_id" {
  description = "ID of the Function App Private Endpoint"
  value       = azurerm_private_endpoint.function_app.id
}

output "private_dns_zone_blob_id" {
  description = "ID of the Blob Storage Private DNS Zone"
  value       = azurerm_private_dns_zone.blob.id
}

output "private_dns_zone_file_id" {
  description = "ID of the File Storage Private DNS Zone"
  value       = azurerm_private_dns_zone.file.id
}

output "private_dns_zone_vault_id" {
  description = "ID of the Key Vault Private DNS Zone"
  value       = azurerm_private_dns_zone.vault.id
}

output "private_dns_zone_functions_id" {
  description = "ID of the Functions Private DNS Zone"
  value       = azurerm_private_dns_zone.functions.id
}
