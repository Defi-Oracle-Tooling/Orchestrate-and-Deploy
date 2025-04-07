# Absolute Realms Hierarchy Management

This submodule provides tools and visualization for managing the hierarchical structure of Absolute Realms within GitHub Enterprise environments.

## Overview

The Absolute Realms hierarchy visualization tool allows you to:

- Visualize the complete organizational structure in an interactive graph
- Edit hierarchy details and properties
- Synchronize hierarchy changes with GitHub Enterprise
- Automate the creation of organizations, teams, and repositories that follow the hierarchy

## Installation and Setup

### Prerequisites

- Node.js (version 16 or higher)
- pnpm package manager
- GitHub Enterprise instance with API access
- Azure subscription (for deployment)

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd Orchestrate-and-Deploy
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up environment variables:**
   
   Create a `.env` file in the hierarchical-chart directory:
   ```
   REACT_APP_GITHUB_API_URL=https://github.enterprise.yourdomain.com/api/v3
   REACT_APP_GITHUB_TOKEN=your_github_personal_access_token
   ```

   Or for GitHub App authentication:
   ```
   REACT_APP_GITHUB_API_URL=https://github.enterprise.yourdomain.com/api/v3
   REACT_APP_GITHUB_APP_ID=your_github_app_id
   REACT_APP_GITHUB_PRIVATE_KEY=your_github_app_private_key
   REACT_APP_GITHUB_INSTALLATION_ID=your_github_app_installation_id
   ```

4. **Start the development server:**
   ```bash
   pnpm --filter absolute-realms-submodule start
   ```

## Deployment to Azure

This submodule can be deployed to Azure using either ARM templates or Terraform.

### Azure Resource Requirements

- Azure Static Web App (for hosting the React application)
- Azure Functions (for API integrations)
- Azure Key Vault (for storing GitHub credentials securely)
- Azure Monitor (for operational telemetry)

### Deployment with ARM Templates

1. Navigate to the infrastructure directory:
   ```bash
   cd packages/absolute-realms-submodule/infrastructure/arm-templates
   ```

2. Deploy the template:
   ```bash
   az login
   az group create --name absolute-realms-rg --location eastus
   az deployment group create \
     --resource-group absolute-realms-rg \
     --template-file azure-resources.json \
     --parameters environment=production
   ```

### Deployment with Terraform

1. Navigate to the Terraform directory:
   ```bash
   cd packages/absolute-realms-submodule/infrastructure/terraform
   ```

2. Initialize and apply the Terraform configuration:
   ```bash
   terraform init
   terraform plan -var environment=production
   terraform apply -var environment=production
   ```

## Integration with GitHub Enterprise

The hierarchical visualization tool integrates with GitHub Enterprise through the GitHub API. See the [GitHub API Integration Guide](docs/api/github-api-integration.md) for detailed instructions.

### Key Integration Points

1. **Authentication**: Setup both OAuth app and GitHub App authentication options
2. **Organization Management**: Create and configure organizations based on hierarchy nodes
3. **Team Structure**: Establish nested teams following the hierarchical design
4. **Repository Governance**: Apply consistent repository settings and branch protection rules

## Documentation

Refer to the following documentation for more details:

- [Realm Structure Documentation](docs/hierarchy/realm-structure.md): Details of the hierarchical structure
- [Integration Guide](docs/hierarchy/integration-guide.md): Instructions for integrating with other systems
- [GitHub Enterprise Setup Guide](docs/setup/github-enterprise-setup.md): Guide for configuring GitHub Enterprise
- [Azure Infrastructure Setup](docs/setup/azure-infrastructure.md): Guide for setting up Azure resources
- [GitHub API Integration Guide](docs/api/github-api-integration.md): Details on GitHub API integration

## Developer Workflow

1. **Edit Hierarchy**: Use the hierarchical chart to visualize and edit the organizational structure
2. **Preview Changes**: Review changes before applying them to GitHub Enterprise
3. **Sync Structure**: Apply changes to GitHub Enterprise through the integrated API
4. **Verify Permissions**: Confirm that permissions are correctly applied

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on the development workflow and contribution guidelines.

## Security

- All credentials are stored in Azure Key Vault
- Managed Identities are used for service-to-service authentication
- RBAC is implemented for least privilege access

## Support and Maintenance

For issues or questions about this submodule, please contact the GitHub Enterprise administration team.