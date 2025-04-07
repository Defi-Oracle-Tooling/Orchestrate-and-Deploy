resource_group_name = "absoluterealms-prod-rg"
location            = "eastus2"
environment         = "production"

tags = {
  Environment        = "Production"
  Project            = "Absolute Realms"
  Owner              = "DevOps Team"
  CostCenter         = "IT-123"
  DataClassification = "Confidential"
}

authorized_ip_ranges = [
  "10.0.0.0/24",  # Example: Production network
  "172.16.0.0/24" # Example: Operations network
]

enable_github_app_auth = true
github_base_url        = "https://api.github.com"
github_enterprise_url  = "https://github.enterprise.yourdomain.com"
github_api_url         = "https://github.enterprise.yourdomain.com/api/v3"
