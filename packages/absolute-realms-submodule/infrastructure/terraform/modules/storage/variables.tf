variable "name" {
  description = "The name prefix for the storage account"
  type        = string
}

variable "resource_group_name" {
  description = "The name of the resource group"
  type        = string
}

variable "location" {
  description = "The Azure region where the storage account will be created"
  type        = string
}

variable "tags" {
  description = "A map of tags to apply to the storage account"
  type        = map(string)
  default     = {}
}

variable "authorized_ip_ranges" {
  description = "List of authorized IP ranges in CIDR format that can access the storage account"
  type        = list(string)
  default     = []
}

variable "enable_infrastructure_encryption" {
  description = "Whether to enable infrastructure encryption (double encryption)"
  type        = bool
  default     = true
}

variable "environment" {
  description = "The environment (dev, test, prod, etc.)"
  type        = string
}

variable "allowed_cors_origins" {
  description = "List of origins allowed for CORS"
  type        = list(string)
  default     = []
}
