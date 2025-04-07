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

variable "vnet_name" {
  description = "Name of the virtual network"
  type        = string
  default     = ""
}

variable "vnet_address_space" {
  description = "Address space for the virtual network"
  type        = list(string)
  default     = ["10.0.0.0/16"]
}

variable "subnet_config" {
  description = "Configuration for subnets"
  type = list(object({
    name              = string
    address_prefix    = string
    service_endpoints = list(string)
    delegation        = optional(string)
  }))
  default = []
}

locals {
  base_name = "absoluterealms"
  vnet_name = var.vnet_name != "" ? var.vnet_name : "${local.base_name}-vnet-${var.environment}"

  common_tags = merge({
    Environment = var.environment
    Project     = "Absolute Realms"
    ManagedBy   = "Terraform"
    Module      = "Networking"
  }, var.tags)
}

resource "azurerm_virtual_network" "main" {
  name                = local.vnet_name
  resource_group_name = var.resource_group_name
  location            = var.location
  address_space       = var.vnet_address_space
  tags                = local.common_tags
}

resource "azurerm_subnet" "subnets" {
  for_each = { for subnet in var.subnet_config : subnet.name => subnet }

  name                 = each.key
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [each.value.address_prefix]
  service_endpoints    = each.value.service_endpoints

  dynamic "delegation" {
    for_each = each.value.delegation != null ? [each.value.delegation] : []
    content {
      name = "delegation"
      service_delegation {
        name = delegation.value
      }
    }
  }
}

# Network Security Group with best practices
resource "azurerm_network_security_group" "main" {
  name                = "${local.base_name}-nsg-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = local.common_tags
}

# Default NSG rules
resource "azurerm_network_security_rule" "deny_all_inbound" {
  name                        = "DenyAllInbound"
  priority                    = 4096
  direction                   = "Inbound"
  access                      = "Deny"
  protocol                    = "*"
  source_port_range           = "*"
  destination_port_range      = "*"
  source_address_prefix       = "*"
  destination_address_prefix  = "*"
  resource_group_name         = var.resource_group_name
  network_security_group_name = azurerm_network_security_group.main.name
}

# Outputs
output "vnet_id" {
  description = "ID of the virtual network"
  value       = azurerm_virtual_network.main.id
}

output "vnet_name" {
  description = "Name of the virtual network"
  value       = azurerm_virtual_network.main.name
}

output "subnet_ids" {
  description = "Map of subnet names to their IDs"
  value       = { for name, subnet in azurerm_subnet.subnets : name => subnet.id }
}

output "nsg_id" {
  description = "ID of the network security group"
  value       = azurerm_network_security_group.main.id
}
