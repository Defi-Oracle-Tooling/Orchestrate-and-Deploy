terraform {
  backend "azurerm" {
    # These values can be configured via -backend-config options when running terraform init
    # Or they can be added directly here (not recommended for sensitive values)
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "tfstateabsoluterealms"
    container_name       = "terraform-state"
    key                  = "absolute-realms.tfstate"
  }
}
