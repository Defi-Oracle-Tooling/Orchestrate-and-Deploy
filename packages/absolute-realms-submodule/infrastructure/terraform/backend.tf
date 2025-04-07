terraform {
  backend "azurerm" {
    # Azure Storage account configured for secure Terraform state management
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "tfstateabsoluterealms"
    container_name       = "terraform-state"
    key                  = "absolute-realms.tfstate"
  }
}
