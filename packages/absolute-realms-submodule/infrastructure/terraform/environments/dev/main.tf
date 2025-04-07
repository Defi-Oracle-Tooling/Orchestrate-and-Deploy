locals {
  environment = "dev"
  location    = "eastus"

  tags = {
    Environment = local.environment
    Project     = "Absolute Realms"
    ManagedBy   = "Terraform"
    Owner       = "DevOps"
  }
}

# Data source for the Azure Resource Group
data "azurerm_resource_group" "main" {
  name = var.resource_group_name
}

# Data source for current Azure configuration
data "azurerm_client_config" "current" {}

# Networking Module
module "networking" {
  source = "../../modules/networking"

  resource_group_name = data.azurerm_resource_group.main.name
  location            = local.location
  environment         = local.environment
  tags                = local.tags

  vnet_address_space = ["10.0.0.0/16"]
  subnet_config = [
    {
      name              = "function-subnet"
      address_prefix    = "10.0.1.0/24"
      service_endpoints = ["Microsoft.Storage", "Microsoft.KeyVault"]
      delegation        = "Microsoft.Web/serverFarms"
    },
    {
      name              = "private-endpoints-subnet"
      address_prefix    = "10.0.2.0/24"
      service_endpoints = ["Microsoft.Storage", "Microsoft.KeyVault"]
      delegation        = null
    }
  ]
}

# Security Module
module "security" {
  source = "../../modules/security"

  resource_group_name = data.azurerm_resource_group.main.name
  location            = local.location
  environment         = local.environment
  tags                = local.tags
  tenant_id           = data.azurerm_client_config.current.tenant_id

  subnet_ids = [module.networking.subnet_ids["private-endpoints-subnet"]]
}

# Storage Module
module "storage" {
  source = "../../modules/storage"

  resource_group_name = data.azurerm_resource_group.main.name
  location            = local.location
  environment         = local.environment
  tags                = local.tags

  # Allow access from function subnet and developer IPs
  authorized_ip_ranges = var.developer_ip_ranges
  subnet_ids           = [module.networking.subnet_ids["function-subnet"]]
}

# Compute Module
module "compute" {
  source = "../../modules/compute"

  resource_group_name = data.azurerm_resource_group.main.name
  location            = local.location
  environment         = local.environment
  tags                = local.tags

  storage_account_name       = module.storage.storage_account_name
  storage_account_access_key = module.storage.storage_account_access_key
  key_vault_name             = module.security.key_vault_name
  user_identity_id           = module.security.user_identity_id
  user_identity_client_id    = module.security.user_identity_client_id
  subnet_id                  = module.networking.subnet_ids["function-subnet"]
  log_analytics_workspace_id = module.security.log_analytics_workspace_id
}

# Outputs
output "function_app_url" {
  description = "URL of the Function App"
  value       = module.compute.function_app_url
}

output "static_site_url" {
  description = "URL of the Static Web App"
  value       = module.compute.static_site_url
}

output "key_vault_url" {
  description = "URL of the Key Vault"
  value       = module.security.key_vault_uri
}
