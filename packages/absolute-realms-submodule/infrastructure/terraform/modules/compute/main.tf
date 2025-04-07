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

variable "storage_account_name" {
  description = "Name of the storage account for the function app"
  type        = string
}

variable "storage_account_access_key" {
  description = "Access key for the storage account"
  type        = string
  sensitive   = true
}

variable "key_vault_name" {
  description = "Name of the Key Vault"
  type        = string
}

variable "user_identity_id" {
  description = "ID of the user-assigned managed identity"
  type        = string
}

variable "user_identity_client_id" {
  description = "Client ID of the user-assigned managed identity"
  type        = string
}

variable "subnet_id" {
  description = "ID of the subnet to integrate with function app"
  type        = string
  default     = ""
}

variable "log_analytics_workspace_id" {
  description = "ID of the Log Analytics workspace for diagnostics"
  type        = string
}

locals {
  base_name             = "absoluterealms"
  function_app_name     = "${local.base_name}-func-${var.environment}-${substr(md5(var.resource_group_name), 0, 8)}"
  static_site_name      = "${local.base_name}-swa-${var.environment}-${substr(md5(var.resource_group_name), 0, 8)}"
  app_insights_name     = "${local.base_name}-ai-${var.environment}-${substr(md5(var.resource_group_name), 0, 8)}"
  app_service_plan_name = "${local.base_name}-asp-${var.environment}-${substr(md5(var.resource_group_name), 0, 8)}"

  common_tags = merge({
    Environment = var.environment
    Project     = "Absolute Realms"
    ManagedBy   = "Terraform"
    Module      = "Compute"
  }, var.tags)
}

# Application Insights for monitoring
resource "azurerm_application_insights" "main" {
  name                = local.app_insights_name
  resource_group_name = var.resource_group_name
  location            = var.location
  application_type    = "web"
  workspace_id        = var.log_analytics_workspace_id

  tags = local.common_tags
}

# App Service Plan
resource "azurerm_app_service_plan" "main" {
  name                = local.app_service_plan_name
  resource_group_name = var.resource_group_name
  location            = var.location
  kind                = "Linux"
  reserved            = true

  sku {
    tier = "Dynamic"
    size = "Y1"
  }

  tags = local.common_tags
}

# Function App with enhanced security
resource "azurerm_function_app" "main" {
  name                       = local.function_app_name
  resource_group_name        = var.resource_group_name
  location                   = var.location
  app_service_plan_id        = azurerm_app_service_plan.main.id
  storage_account_name       = var.storage_account_name
  storage_account_access_key = var.storage_account_access_key
  os_type                    = "linux"
  version                    = "~4"
  https_only                 = true

  identity {
    type         = "UserAssigned"
    identity_ids = [var.user_identity_id]
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME              = "node"
    WEBSITE_NODE_DEFAULT_VERSION          = "~18" # Updated to Node.js 18 LTS
    APPINSIGHTS_INSTRUMENTATIONKEY        = azurerm_application_insights.main.instrumentation_key
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.main.connection_string
    KEY_VAULT_NAME                        = var.key_vault_name
    WEBSITE_RUN_FROM_PACKAGE              = "1"
    AZURE_CLIENT_ID                       = var.user_identity_client_id
    SCM_DO_BUILD_DURING_DEPLOYMENT        = "true"
    ENABLE_ORYX_BUILD                     = "true"
    # Add health check settings
    WEBSITE_HEALTHCHECK_MAXPINGFAILURES = "2"
    # Add performance and scaling settings
    FUNCTIONS_EXTENSION_VERSION              = "~4"
    WEBSITE_CONTENTAZUREFILECONNECTIONSTRING = ""     # Use managed storage 
    WEBSITE_CONTENTOVERVNET                  = "1"    # Enable content over VNet
    AzureWebJobsDisableHomepage              = "true" # Security improvement
    # Auto-scale settings
    SCALE_CONTROLLER_LOGGING_ENABLED = "AppInsights:Verbose"
  }

  site_config {
    linux_fx_version                  = "NODE|18" # Updated to Node.js 18 LTS
    min_tls_version                   = "1.2"
    ftps_state                        = "Disabled"
    http2_enabled                     = true
    vnet_route_all_traffic            = var.subnet_id != "" ? true : false
    health_check_path                 = "/api/health" # Add health check endpoint
    health_check_eviction_time_in_min = 2

    cors {
      allowed_origins = ["https://${local.static_site_name}.azurestaticapps.net"]
    }

    # Add IP security restrictions
    ip_restriction {
      action      = "Allow"
      service_tag = "AzureCloud"
      priority    = 100
      name        = "Allow Azure Services"
    }
  }

  # Only add private endpoint if subnet_id is provided
  dynamic "private_site_access_v2" {
    for_each = var.subnet_id != "" ? [var.subnet_id] : []
    content {
      virtual_network_subnet_id = private_site_access_v2.value
    }
  }

  tags = local.common_tags
}

# Function App slots for zero-downtime deployments
resource "azurerm_function_app_slot" "staging" {
  name                       = "staging"
  function_app_name          = azurerm_function_app.main.name
  resource_group_name        = var.resource_group_name
  location                   = var.location
  app_service_plan_id        = azurerm_app_service_plan.main.id
  storage_account_name       = var.storage_account_name
  storage_account_access_key = var.storage_account_access_key
  os_type                    = "linux"
  version                    = "~4"
  https_only                 = true

  identity {
    type         = "UserAssigned"
    identity_ids = [var.user_identity_id]
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME              = "node"
    WEBSITE_NODE_DEFAULT_VERSION          = "~18" # Updated to Node.js 18 LTS
    APPINSIGHTS_INSTRUMENTATIONKEY        = azurerm_application_insights.main.instrumentation_key
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.main.connection_string
    KEY_VAULT_NAME                        = var.key_vault_name
    WEBSITE_RUN_FROM_PACKAGE              = "1"
    AZURE_CLIENT_ID                       = var.user_identity_client_id
    SCM_DO_BUILD_DURING_DEPLOYMENT        = "true"
    ENABLE_ORYX_BUILD                     = "true"
    SLOT_NAME                             = "staging"
    # Add health check settings
    WEBSITE_HEALTHCHECK_MAXPINGFAILURES = "2"
    # Add performance and scaling settings
    FUNCTIONS_EXTENSION_VERSION              = "~4"
    WEBSITE_CONTENTAZUREFILECONNECTIONSTRING = ""     # Use managed storage 
    WEBSITE_CONTENTOVERVNET                  = "1"    # Enable content over VNet
    AzureWebJobsDisableHomepage              = "true" # Security improvement
    # Auto-scale settings
    SCALE_CONTROLLER_LOGGING_ENABLED = "AppInsights:Verbose"
  }

  site_config {
    linux_fx_version                  = "NODE|18" # Updated to Node.js 18 LTS
    min_tls_version                   = "1.2"
    ftps_state                        = "Disabled"
    http2_enabled                     = true
    health_check_path                 = "/api/health" # Add health check endpoint
    health_check_eviction_time_in_min = 2

    cors {
      allowed_origins = ["https://${local.static_site_name}.azurestaticapps.net"]
    }

    # Add IP security restrictions
    ip_restriction {
      action      = "Allow"
      service_tag = "AzureCloud"
      priority    = 100
      name        = "Allow Azure Services"
    }
  }

  tags = local.common_tags
}

# Static Web App
resource "azurerm_static_site" "main" {
  name                = local.static_site_name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku_tier            = "Standard"
  sku_size            = "Standard"

  tags = local.common_tags
}

# Monitor Alert Rules for Function App
resource "azurerm_monitor_metric_alert" "function_app_failures" {
  name                = "${local.function_app_name}-failures-alert"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_function_app.main.id]
  description         = "Alert when function app failures exceed threshold"
  severity            = 2

  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "FunctionExecutionCount"
    aggregation      = "Total"
    operator         = "GreaterThan"
    threshold        = 5

    dimension {
      name     = "Status"
      operator = "Include"
      values   = ["Failure"]
    }
  }

  action {
    action_group_id = azurerm_monitor_action_group.ops.id
  }

  tags = local.common_tags
}

# Monitor Alert Rules for Function App performance
resource "azurerm_monitor_metric_alert" "function_app_latency" {
  name                = "${local.function_app_name}-latency-alert"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_function_app.main.id]
  description         = "Alert when function app average latency exceeds threshold"
  severity            = 2

  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "FunctionExecutionUnits"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 1000
  }

  action {
    action_group_id = azurerm_monitor_action_group.ops.id
  }

  tags = local.common_tags
}

# Action Group for alerts
resource "azurerm_monitor_action_group" "ops" {
  name                = "${local.base_name}-ops-alert-group"
  resource_group_name = var.resource_group_name
  short_name          = "ops-alerts"

  email_receiver {
    name                    = "ops-team"
    email_address           = "ops@example.com"
    use_common_alert_schema = true
  }

  tags = local.common_tags
}

# Function App Diagnostic Settings
resource "azurerm_monitor_diagnostic_setting" "function_app" {
  name                       = "${local.function_app_name}-diag"
  target_resource_id         = azurerm_function_app.main.id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  enabled_log {
    category = "FunctionAppLogs"
    retention_policy {
      enabled = true
      days    = 30
    }
  }

  enabled_log {
    category = "FunctionExecutionLogs"
    retention_policy {
      enabled = true
      days    = 30
    }
  }

  enabled_log {
    category = "AllMetrics"
    retention_policy {
      enabled = true
      days    = 30
    }
  }

  metric {
    category = "AllMetrics"
    retention_policy {
      enabled = true
      days    = 30
    }
  }
}

# Add VNet Integration for Function App if subnet_id is provided
resource "azurerm_app_service_virtual_network_swift_connection" "function_vnet_integration" {
  count          = var.subnet_id != "" ? 1 : 0
  app_service_id = azurerm_function_app.main.id
  subnet_id      = var.subnet_id
}

# Outputs
output "function_app_id" {
  description = "ID of the Function App"
  value       = azurerm_function_app.main.id
}

output "function_app_name" {
  description = "Name of the Function App"
  value       = azurerm_function_app.main.name
}

output "function_app_url" {
  description = "URL of the Function App"
  value       = "https://${azurerm_function_app.main.default_hostname}"
}

output "static_site_id" {
  description = "ID of the Static Web App"
  value       = azurerm_static_site.main.id
}

output "static_site_name" {
  description = "Name of the Static Web App"
  value       = azurerm_static_site.main.name
}

output "static_site_url" {
  description = "URL of the Static Web App"
  value       = azurerm_static_site.main.default_host_name
}

output "app_insights_instrumentation_key" {
  description = "Instrumentation Key for Application Insights"
  value       = azurerm_application_insights.main.instrumentation_key
  sensitive   = true
}

output "app_insights_connection_string" {
  description = "Connection String for Application Insights"
  value       = azurerm_application_insights.main.connection_string
  sensitive   = true
}
