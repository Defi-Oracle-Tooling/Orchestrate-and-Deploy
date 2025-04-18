terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.0"
    }
  }
  # Backend configuration moved to backend.tf
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = false
    }
  }
}

provider "azuread" {}

# Local variables
locals {
  base_name             = "absoluterealms"
  storage_account_name  = lower(replace("${local.base_name}${var.environment}${substr(md5(var.resource_group_name), 0, 8)}", "-", ""))
  key_vault_name        = "${local.base_name}-kv-${var.environment}-${substr(md5(var.resource_group_name), 0, 8)}"
  function_app_name     = "${local.base_name}-func-${var.environment}-${substr(md5(var.resource_group_name), 0, 8)}"
  static_site_name      = "${local.base_name}-swa-${var.environment}-${substr(md5(var.resource_group_name), 0, 8)}"
  app_insights_name     = "${local.base_name}-ai-${var.environment}-${substr(md5(var.resource_group_name), 0, 8)}"
  app_service_plan_name = "${local.base_name}-asp-${var.environment}-${substr(md5(var.resource_group_name), 0, 8)}"
  user_identity_name    = "${local.base_name}-id-${var.environment}-${substr(md5(var.resource_group_name), 0, 8)}"

  common_tags = merge({
    Environment = var.environment
    Project     = "Absolute Realms"
    ManagedBy   = "Terraform"
  }, var.tags)
}

# Resource Group
data "azurerm_resource_group" "main" {
  name = var.resource_group_name
}

# User Assigned Managed Identity
resource "azurerm_user_assigned_identity" "main" {
  name                = local.user_identity_name
  resource_group_name = data.azurerm_resource_group.main.name
  location            = var.location
  tags                = local.common_tags
}

# Key Vault
resource "azurerm_key_vault" "main" {
  name                       = local.key_vault_name
  resource_group_name        = data.azurerm_resource_group.main.name
  location                   = var.location
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  soft_delete_retention_days = 90
  purge_protection_enabled   = true
  sku_name                   = "standard"

  network_acls {
    default_action = "Allow"
    bypass         = "AzureServices"
  }

  tags = local.common_tags
}

# Key Vault Access Policy for Managed Identity
resource "azurerm_key_vault_access_policy" "managed_identity" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_user_assigned_identity.main.principal_id

  secret_permissions = [
    "Get",
    "List",
    "Set"
  ]
}

# Storage Account
resource "azurerm_storage_account" "main" {
  name                            = local.storage_account_name
  resource_group_name             = data.azurerm_resource_group.main.name
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  #  https_only_enabled              = true
  infrastructure_encryption_enabled = true
  shared_access_key_enabled         = false

  # Network rules for restricting access
  network_rules {
    default_action             = "Deny"
    bypass                     = ["AzureServices"]
    ip_rules                   = var.authorized_ip_ranges
    virtual_network_subnet_ids = []
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

    # CORS configuration
    cors_rule {
      allowed_headers    = ["*"]
      allowed_methods    = ["GET", "HEAD"]
      allowed_origins    = ["https://${local.static_site_name}.azurestaticapps.net"]
      exposed_headers    = ["*"]
      max_age_in_seconds = 3600
    }

    # Prevent abuse by ensuring uploads use SAS tokens
    default_service_version = "2020-06-12"
  }

  # Identity for accessing other Azure resources
  identity {
    type         = "SystemAssigned, UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.main.id]
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

# Application Insights
resource "azurerm_application_insights" "main" {
  name                = local.app_insights_name
  resource_group_name = data.azurerm_resource_group.main.name
  location            = var.location
  application_type    = "web"

  tags = local.common_tags
}

# Service Plan
resource "azurerm_service_plan" "main" {
  name                = local.app_service_plan_name
  resource_group_name = data.azurerm_resource_group.main.name
  location            = var.location
  os_type             = "Linux"
  sku_name            = "Y1"

  tags = local.common_tags
}

# Function App
resource "azurerm_linux_function_app" "main" {
  name                       = local.function_app_name
  resource_group_name        = data.azurerm_resource_group.main.name
  location                   = var.location
  service_plan_id            = azurerm_service_plan.main.id
  storage_account_name       = azurerm_storage_account.main.name
  storage_account_access_key = azurerm_storage_account.main.primary_access_key
  https_only                 = true

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.main.id]
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME       = "node"
    WEBSITE_NODE_DEFAULT_VERSION   = "~18"
    APPINSIGHTS_INSTRUMENTATIONKEY = azurerm_application_insights.main.instrumentation_key
    KEY_VAULT_NAME                 = azurerm_key_vault.main.name
    WEBSITE_RUN_FROM_PACKAGE       = "1"
    AZURE_CLIENT_ID                = azurerm_user_assigned_identity.main.client_id
  }

  site_config {
    linux_fx_version = "NODE|18"
    ftps_state       = "Disabled"
    cors {
      allowed_origins = ["https://${local.static_site_name}.azurestaticapps.net"]
    }
  }

  tags = local.common_tags
}

# Static Web App
resource "azurerm_static_site" "main" {
  name                = local.static_site_name
  resource_group_name = data.azurerm_resource_group.main.name
  location            = var.location
  sku_tier            = "Standard"
  sku_size            = "Standard"

  tags = local.common_tags
}

# Current Terraform execution context
data "azurerm_client_config" "current" {}

# Variable for authorized IP ranges
variable "authorized_ip_ranges" {
  description = "List of authorized IP ranges for accessing resources"
  type        = list(string)
  default     = []
}
