variable "resource_group_name" {
  description = "The name of the resource group where resources will be deployed"
  type        = string
  default     = "absolute-realms-dev-rg"
}

variable "developer_ip_ranges" {
  description = "List of developer IP ranges to allow access to resources"
  type        = list(string)
  default     = []
}
