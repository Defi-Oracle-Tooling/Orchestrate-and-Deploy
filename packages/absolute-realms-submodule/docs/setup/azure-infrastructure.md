# Azure Infrastructure Setup

This guide outlines the Azure infrastructure required to support the Absolute Realms hierarchical chart application and GitHub Enterprise integration.

## Infrastructure Overview

The Absolute Realms visualization tool requires several Azure resources to function properly:

- **Azure Static Web App**: Hosts the React-based hierarchical chart application
- **Azure Key Vault**: Securely stores GitHub Enterprise credentials and API tokens
- **Azure Functions**: Provides backend API for GitHub Enterprise integration
- **Azure Monitor**: Monitors application performance and usage
- **Azure AD**: Manages authentication and authorization

## Architecture Diagram

```
┌─────────────────────┐      ┌─────────────────────┐
│                     │      │                     │
│  Azure Static Web   │──────▶   Azure Functions   │
│        App          │      │       (API)         │
│                     │      │                     │
└─────────────────────┘      └──────────▲──────────┘
                                        │
                                        │
┌─────────────────────┐      ┌──────────▼──────────┐      ┌─────────────────────┐
│                     │      │                     │      │                     │
│      Azure AD       │◀─────▶    Azure Key Vault  │◀─────▶  GitHub Enterprise  │
│                     │      │                     │      │                     │
└─────────────────────┘      └─────────────────────┘      └─────────────────────┘
```

## Deployment Methods

You can deploy the required infrastructure using one of two methods:

1. **ARM Templates**: Using the provided Azure Resource Manager templates
2. **Terraform**: Using the provided Terraform configuration files

Both methods create identical infrastructure with the same security configurations and best practices.

## ARM Template Deployment

To deploy using ARM templates:

1. Navigate to the `infrastructure/arm-templates` directory
2. Review the `azure-resources.json` file to understand the resources being created
3. Deploy using the Azure CLI:

```bash
az login
az group create --name absolute-realms-rg --location eastus
az deployment group create \
  --resource-group absolute-realms-rg \
  --template-file azure-resources.json \
  --parameters environment=production
```

## Terraform Deployment

To deploy using Terraform:

1. Navigate to the `infrastructure/terraform` directory
2. Initialize Terraform:

```bash
terraform init
```

3. Review the planned infrastructure:

```bash
terraform plan -var environment=production
```

4. Apply the configuration:

```bash
terraform apply -var environment=production
```

## Post-Deployment Configuration

After deploying the infrastructure, complete these steps:

1. **Configure Azure Static Web App**:
   - Set up GitHub Actions for continuous deployment
   - Configure authentication providers
   - Set up custom domain if needed

2. **Set up Azure Key Vault**:
   - Add GitHub Enterprise API credentials
   - Configure access policies for the Function App
   - Enable logging and monitoring

3. **Configure Azure Functions**:
   - Connect to Key Vault using Managed Identity
   - Set up application settings
   - Configure CORS for the Static Web App

4. **Set up Azure AD Integration**:
   - Create an App Registration for the application
   - Configure API permissions
   - Set up user and group assignments

## Security Considerations

The following security measures are implemented in the infrastructure:

- All sensitive data stored in Azure Key Vault
- Managed Identities used for service-to-service authentication
- Network security groups restrict access to resources
- Private endpoints for Key Vault
- RBAC permissions configured with least privilege

## Monitoring and Operational Management

The infrastructure includes monitoring capabilities:

- Application Insights for performance monitoring
- Azure Monitor alerts for critical conditions
- Diagnostic logs sent to Log Analytics Workspace
- Resource health monitoring

## Cost Optimization

The infrastructure is designed with cost optimization in mind:

- Static Web App on the Standard tier provides cost-effective hosting
- Functions consumption plan for pay-per-execution pricing
- Auto-scaling enabled for all applicable resources
- Resource tags for cost allocation and tracking

## Disaster Recovery

The infrastructure includes disaster recovery capabilities:

- All ARM templates and Terraform configs are version-controlled
- Automated backups of configuration settings
- Cross-region redundancy for critical components
- Recovery playbooks documented in runbooks