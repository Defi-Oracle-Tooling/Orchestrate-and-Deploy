# GitHub API Integration

This guide provides instructions for integrating the Absolute Realms hierarchy visualization with the GitHub Enterprise API.

## API Integration Overview

The hierarchical chart application communicates with GitHub Enterprise through the GitHub REST API to:

- Retrieve existing organizational structures
- Create or modify organizations, teams, and repositories
- Manage access permissions and team memberships
- Synchronize changes between the visualization and GitHub Enterprise

## API Authentication

There are two methods for authenticating with the GitHub Enterprise API:

### Method 1: GitHub App (Recommended)

1. **Create a GitHub App**:
   - Go to your GitHub Enterprise instance: `https://github.enterprise.yourdomain.com/settings/apps/new`
   - Configure the app with the following permissions:
     - Organization: Read/Write
     - Team: Read/Write
     - Repository: Read/Write
     - Members: Read
   - Set the webhook URL to your application's webhook endpoint
   - Generate and securely store a private key

2. **Install the App**:
   - Install the app on all organizations in your hierarchy
   - Note the installation ID for each organization

3. **Authenticate API Calls**:
   - Generate a JWT signed with your private key
   - Exchange the JWT for an installation token
   - Use the installation token for API requests

```typescript
// Example JWT generation and token exchange
import { createAppAuth } from '@octokit/auth-app';

const auth = createAppAuth({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_PRIVATE_KEY,
  installationId: process.env.GITHUB_INSTALLATION_ID,
});

const { token } = await auth({ type: 'installation' });
```

### Method 2: Personal Access Token

1. **Create a Personal Access Token**:
   - Go to: `https://github.enterprise.yourdomain.com/settings/tokens`
   - Generate a new token with the required scopes:
     - `repo`
     - `admin:org`
     - `read:user`
   - Copy and securely store the token

2. **Authenticate API Calls**:
   - Include the token in the Authorization header

```typescript
// Example API call with PAT
fetch('https://github.enterprise.yourdomain.com/api/v3/orgs/executive-branch', {
  headers: {
    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json'
  }
})
```

## API Endpoints

The application uses the following key GitHub API endpoints:

### Organizations

- `GET /orgs/{org}` - Get an organization
- `GET /organizations` - List organizations
- `PATCH /orgs/{org}` - Update an organization

### Teams

- `GET /orgs/{org}/teams` - List teams
- `POST /orgs/{org}/teams` - Create a team
- `GET /orgs/{org}/teams/{team_slug}` - Get a team
- `PATCH /orgs/{org}/teams/{team_slug}` - Update a team
- `DELETE /orgs/{org}/teams/{team_slug}` - Delete a team

### Team Membership

- `GET /orgs/{org}/teams/{team_slug}/members` - List team members
- `PUT /orgs/{org}/teams/{team_slug}/memberships/{username}` - Add team member
- `DELETE /orgs/{org}/teams/{team_slug}/memberships/{username}` - Remove team member

### Repositories

- `GET /orgs/{org}/repos` - List organization repositories
- `POST /orgs/{org}/repos` - Create a repository
- `GET /repos/{owner}/{repo}` - Get a repository
- `PATCH /repos/{owner}/{repo}` - Update a repository

## API Client Implementation

The application uses a structured API client to interact with GitHub Enterprise:

```typescript
// src/services/api.ts
import { Octokit } from '@octokit/rest';

export class GitHubApiClient {
  private octokit: Octokit;
  
  constructor(baseUrl: string, token: string) {
    this.octokit = new Octokit({
      baseUrl,
      auth: token,
      request: {
        timeout: 10000,
      },
    });
  }
  
  // Organization methods
  async getOrganizations() {
    return this.octokit.orgs.list({ per_page: 100 });
  }
  
  async getOrganization(org: string) {
    return this.octokit.orgs.get({ org });
  }
  
  // Team methods
  async getTeams(org: string) {
    return this.octokit.teams.list({ org, per_page: 100 });
  }
  
  async createTeam(org: string, name: string, description: string, parentTeamId?: number) {
    return this.octokit.teams.create({
      org,
      name,
      description,
      parent_team_id: parentTeamId,
      privacy: 'closed',
    });
  }
  
  // Repository methods
  async getRepositories(org: string) {
    return this.octokit.repos.listForOrg({ org, per_page: 100 });
  }
  
  // Additional methods for other API operations...
}
```

## Error Handling and Rate Limiting

The API client implements robust error handling and rate limit management:

1. **Rate Limit Handling**:
   - Check rate limit status with each response
   - Implement exponential backoff for retries
   - Cache responses where appropriate

2. **Error Handling**:
   - Categorize errors by type (authentication, permission, not found)
   - Provide helpful error messages for debugging
   - Log errors for troubleshooting

```typescript
// Example rate limit handling
async function apiCallWithRateLimitHandling() {
  try {
    const response = await apiClient.getOrganizations();
    
    // Check rate limit status
    const rateLimit = response.headers['x-ratelimit-remaining'];
    if (parseInt(rateLimit) < 10) {
      console.warn('Approaching rate limit, slowing down requests');
    }
    
    return response.data;
  } catch (error) {
    if (error.status === 403 && error.headers['x-ratelimit-remaining'] === '0') {
      const resetTime = new Date(parseInt(error.headers['x-ratelimit-reset']) * 1000);
      console.error(`Rate limit exceeded. Resets at ${resetTime}`);
      // Implement retry logic or queue the request
    }
    throw error;
  }
}
```

## Synchronizing with the Hierarchy

To synchronize the hierarchy visualization with GitHub Enterprise:

1. **Import from GitHub**:
   - Fetch organizations, teams, and repositories
   - Convert to hierarchy data structure
   - Update the visualization

2. **Export to GitHub**:
   - Compare hierarchy changes with current GitHub state
   - Generate API operations to synchronize (create, update, delete)
   - Execute operations in the correct order (parent teams before child teams)
   - Verify changes were applied correctly

## Webhook Integration

To keep the visualization up-to-date with changes in GitHub Enterprise:

1. **Configure Webhook**:
   - Set up a webhook in your GitHub App
   - Subscribe to relevant events:
     - `organization` events
     - `team` events
     - `repository` events
     - `membership` events

2. **Process Webhook Events**:
   - Authenticate webhook requests using the webhook secret
   - Parse the event payload
   - Update the hierarchy data accordingly

```javascript
// Example webhook handler
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  
  // Verify webhook signature
  if (!verifyWebhookSignature(req.body, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = req.headers['x-github-event'];
  
  switch (event) {
    case 'organization':
      handleOrganizationEvent(req.body);
      break;
    case 'team':
      handleTeamEvent(req.body);
      break;
    // Handle other events...
  }
  
  res.status(200).send('Webhook processed successfully');
});
```

## Security Considerations

When integrating with the GitHub API:

1. **Secure Credential Storage**:
   - Store all tokens and private keys in Azure Key Vault
   - Never hardcode credentials in the application code
   - Rotate credentials regularly

2. **Least Privilege Access**:
   - Use the minimal set of permissions required
   - Consider read-only access for visualization-only features

3. **Audit API Operations**:
   - Log all API operations performed
   - Monitor for unusual patterns of access
   - Regularly review API usage