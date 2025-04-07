variable "github_app_id" {
  description = "GitHub App ID for API authentication"
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_app_private_key" {
  description = "GitHub App private key for API authentication"
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_installation_id" {
  description = "GitHub App installation ID"
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_enterprise_url" {
  description = "Base URL for GitHub Enterprise server"
  type        = string
  default     = "https://github.enterprise.yourdomain.com"
}

variable "github_api_url" {
  description = "GitHub Enterprise API URL"
  type        = string
  default     = "https://github.enterprise.yourdomain.com/api/v3"
}

variable "resource_group_name" {
  type        = string
  description = "The name of the resource group where resources will be deployed"
}

variable "location" {
  type        = string
  description = "The Azure region where resources will be created"
  default     = "eastus"
}

variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "development"
  validation {
    condition     = contains(["development", "testing", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, testing, staging, production."
  }
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to all resources"
  default     = {}
}

variable "enable_github_app_auth" {
  type        = bool
  description = "Whether to use GitHub App authentication instead of PAT"
  default     = true
}

variable "github_base_url" {
  type        = string
  description = "Base URL for GitHub API (for GitHub Enterprise)"
  default     = "https://api.github.com"
}

# These variables can be set from a tfvars file or environment variables
# terraform apply -var-file="secrets.tfvars"