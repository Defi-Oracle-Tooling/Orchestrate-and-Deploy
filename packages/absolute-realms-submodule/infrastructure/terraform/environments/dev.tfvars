resource_group_name = "absoluterealms-dev-rg"
location            = "eastus"
environment         = "development"

tags = {
  Environment        = "Development"
  Project            = "Absolute Realms"
  Owner              = "DevOps Team"
  CostCenter         = "IT-123"
  DataClassification = "Confidential"
}

authorized_ip_ranges = [
  "192.168.1.0/24", # Example: Office network
  "203.0.113.0/24"  # Example: Remote developer network
]

enable_github_app_auth = true
github_base_url        = "https://api.github.com"
github_enterprise_url  = "https://github.enterprise.yourdomain.com"
github_api_url         = "https://github.enterprise.yourdomain.com/api/v3"
