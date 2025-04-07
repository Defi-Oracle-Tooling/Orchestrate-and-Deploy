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

variable "authorized_ip_ranges" {
  description = "List of authorized IP ranges in CIDR format that can access the storage account"
  type        = list(string)
  default     = []
}

variable "subnet_ids" {
  description = "List of subnet IDs to allow access to the storage account"
  type        = list(string)
  default     = []
}

locals {
  base_name            = "absoluterealms"
  storage_account_name = lower(replace("${local.base_name}${var.environment}${substr(md5(var.resource_group_name), 0, 8)}", "-", ""))

  common_tags = merge({
    Environment = var.environment
    Project     = "Absolute Realms"
    ManagedBy   = "Terraform"
    Module      = "Storage"
  }, var.tags)
}

resource "azurerm_storage_account" "main" {
  name                              = local.storage_account_name
  resource_group_name               = var.resource_group_name
  location                          = var.location
  account_tier                      = "Standard"
  account_replication_type          = "LRS"
  min_tls_version                   = "TLS1_2"
  allow_nested_items_to_be_public   = false
  infrastructure_encryption_enabled = true
  shared_access_key_enabled         = false

  # Network rules for restricting access
  network_rules {
    default_action             = "Deny"
    bypass                     = ["AzureServices"]
    ip_rules                   = var.authorized_ip_ranges
    virtual_network_subnet_ids = var.subnet_ids
  }

  # Blob soft delete and versioning policies
  blob_properties {
    versioning_enabled       = true
    change_feed_enabled      = true
    last_access_time_enabled = true

    # Soft delete for blobs
    delete_retention_policy {
      days = 7 # Retain deleted blobs for 7 days
    }

    # Soft delete for containers
    container_delete_retention_policy {
      days = 7 # Retain deleted containers for 7 days
    }

    # Prevent abuse by ensuring uploads use SAS tokens
    default_service_version = "2020-06-12"
  }

  tags = local.common_tags
}

# Storage Account Lifecycle Management Policy
resource "azurerm_storage_management_policy" "lifecycle" {
  storage_account_id = azurerm_storage_account.main.id

  rule {
    name    = "archiveOldLogs"
    enabled = true
    filters {
      prefix_match = ["logs/"]
      blob_types   = ["blockBlob"]
    }
    actions {
      base_blob {
        tier_to_cool_after_days_since_modification_greater_than    = 30
        tier_to_archive_after_days_since_modification_greater_than = 90
        delete_after_days_since_modification_greater_than          = 365
      }
      snapshot {
        delete_after_days_since_creation_greater_than = 30
      }
      version {
        delete_after_days_since_creation = 90
      }
    }
  }

  rule {
    name    = "cleanupTempData"
    enabled = true
    filters {
      prefix_match = ["temp/"]
      blob_types   = ["blockBlob"]
    }
    actions {
      base_blob {
        delete_after_days_since_modification_greater_than = 7
      }
    }
  }
}

# Storage Account Advanced Threat Protection
resource "azurerm_advanced_threat_protection" "storage" {
  target_resource_id = azurerm_storage_account.main.id
  enabled            = true
}

# Storage Containers
resource "azurerm_storage_container" "containers" {
  for_each              = toset(["config", "data", "logs", "temp"])
  name                  = each.key
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

# Private Endpoint for secure access
resource "azurerm_private_endpoint" "storage_blob" {
  count               = length(var.subnet_ids) > 0 ? 1 : 0
  name                = "${local.storage_account_name}-blob-pe"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.subnet_ids[0]

  private_service_connection {
    name                           = "${local.storage_account_name}-blob-connection"
    private_connection_resource_id = azurerm_storage_account.main.id
    is_manual_connection           = false
    subresource_names              = ["blob"]
  }

  tags = local.common_tags
}

# Outputs
output "storage_account_id" {
  description = "ID of the storage account"
  value       = azurerm_storage_account.main.id
}

output "storage_account_name" {
  description = "Name of the storage account"
  value       = azurerm_storage_account.main.name
}

output "primary_blob_endpoint" {
  description = "Primary blob endpoint for the storage account"
  value       = azurerm_storage_account.main.primary_blob_endpoint
}

output "container_ids" {
  description = "Map of container names to their IDs"
  value       = { for name, container in azurerm_storage_container.containers : name => container.id }
}
