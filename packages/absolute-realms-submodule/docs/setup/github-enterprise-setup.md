# GitHub Enterprise Setup Guide

This guide provides detailed instructions for setting up and configuring GitHub Enterprise to work with the Absolute Realms hierarchical structure.

## Initial Setup

### Prerequisites

- GitHub Enterprise Server (version 3.5 or higher)
- Administrator access to the GitHub Enterprise instance
- Azure AD or other identity provider for SAML authentication

### Base Configuration

1. **Configure GitHub Enterprise Instance**:
   - Access your GitHub Enterprise management console
   - Configure enterprise settings including:
     - Authentication method (SAML recommended)
     - Email notifications
     - Repository visibility defaults
     - IP allow lists if required

2. **Configure SAML Authentication**:
   - Connect GitHub Enterprise to your identity provider
   - Configure SAML assertions to include group membership
   - Test single sign-on functionality

## Organization Structure

Following the Absolute Realms hierarchy, you'll need to create several organizations:

1. **Create Organizations for Sovereign Branches**:
   - Executive Branch
   - Parliamentary Branch 
   - Judicial Branch

2. **Configure Organization Settings**:
   - Base permission levels (Read recommended)
   - Member privileges
   - Repository creation permissions
   - Default branch protection rules

## Team Structure

For each organization, create a team structure that maps to the hierarchy:

1. **Create Parent Teams for Ministries**:
   - Ministry of Finance
   - Other ministries as defined in the hierarchy

2. **Create Child Teams for Departments**:
   - Department of Realms Treasury (parent: Ministry of Finance)
   - Department of External Treasury (parent: Ministry of Finance)

3. **Configure Team Settings**:
   - Team visibility
   - Team permissions to repositories
   - Code review assignment rules

## Repository Configuration

Configure repositories to align with the hierarchy:

1. **Repository Naming Convention**:
   - Use prefixes that reflect the hierarchy position
   - Example: `finance-treasury-payments-api`

2. **Branch Protection Rules**:
   - Require pull request reviews before merging
   - Require status checks to pass
   - Include administrators in restrictions
   - Restrict who can push to matching branches

3. **CODEOWNERS File**:
   - Create CODEOWNERS files that map to the team hierarchy
   - Example:
     ```
     # Ministry of Finance owns all financial code
     /financial/ @executive-branch/ministry-of-finance
     
     # Department of Treasury owns treasury-specific code
     /financial/treasury/ @executive-branch/ministry-of-finance/dept-realms-treasury
     ```

## Compliance and Audit

Set up compliance monitoring:

1. **Audit Log Streaming**:
   - Configure audit log streaming to your SIEM or log aggregation system
   - Set up alerts for important security events

2. **Automated Compliance Checks**:
   - Implement GitHub Actions workflows that verify compliance with hierarchy rules
   - Schedule regular audits of organization structure

## API Integration

Configure API access for the hierarchical chart application:

1. **Create GitHub App**:
   - Create a GitHub App with appropriate permissions:
     - Organization: read/write
     - Team: read/write
     - Repository: read/write
     - Members: read

2. **Install GitHub App**:
   - Install the app on all organizations in the hierarchy
   - Generate and securely store the private key

3. **Configure Webhook**:
   - Set up a webhook to notify the application of changes
   - Configure the secret token for webhook security

## Azure Infrastructure Integration

If using Azure to host the hierarchical chart application:

1. **Configure Managed Identity**:
   - Set up a system-assigned managed identity for the application
   - Grant appropriate permissions to Azure Key Vault

2. **Store GitHub Credentials**:
   - Store the GitHub App private key and other secrets in Azure Key Vault
   - Configure the application to retrieve credentials from Key Vault

## Testing the Setup

Verify your setup with these tests:

1. **Organization Structure Test**:
   - Confirm all organizations exist
   - Verify parent-child relationships between teams

2. **Permission Test**:
   - Test repository access for different teams
   - Verify that permissions correctly flow from parent to child teams

3. **API Integration Test**:
   - Use the hierarchical chart application to view the structure
   - Make a small change and verify it propagates to GitHub Enterprise

## Troubleshooting

Common issues and their solutions:

- **SAML Authentication Issues**: Verify assertions and certificate expiration
- **Permission Synchronization Delays**: Allow time for permission caching to update
- **API Rate Limiting**: Implement exponential backoff in API clients
- **Organization Visibility**: Check enterprise settings for organization visibility