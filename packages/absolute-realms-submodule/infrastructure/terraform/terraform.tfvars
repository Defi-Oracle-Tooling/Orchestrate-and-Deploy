resource_group_name = "absolute-realms-rg"
location            = "eastus"
environment         = "development"
tags = {
  Project    = "Orchestrate-and-Deploy"
  Department = "Engineering"
  Owner      = "DevOps"
}

# GitHub settings - replace with actual values if using GitHub integration
github_enterprise_url  = "https://github.enterprise.yourdomain.com"
github_api_url         = "https://github.enterprise.yourdomain.com/api/v3"
enable_github_app_auth = false # Set to true if using GitHub App auth
