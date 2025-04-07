import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { KeyVaultService } from "../KeyVaultService";

// Define the hierarchy node structure
interface HierarchyNode {
  ID: string;
  Parent: string;
  Type: string;
  Name: string;
  Children: HierarchyNode[];
}

// Define response structure
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Azure Function to export hierarchy to GitHub Enterprise
 */
const exportHierarchyFunction: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  context.log('Processing export hierarchy request');
  
  try {
    // Validate request
    if (!req.body || !req.body.hierarchy) {
      throw new Error('Request body must contain a hierarchy object');
    }
    
    const hierarchyRoot = req.body.hierarchy as HierarchyNode;
    
    // Get GitHub credentials from Key Vault
    const keyVaultService = new KeyVaultService();
    const credentials = await keyVaultService.getGitHubCredentials();
    
    // Get GitHub Enterprise API URL from request or environment
    const baseUrl = req.body.baseUrl || 
                   process.env.GITHUB_API_URL || 
                   'https://api.github.com';
    
    // Initialize Octokit with appropriate auth
    let octokit: Octokit;
    
    if (credentials.token) {
      // Use token-based auth
      octokit = new Octokit({
        baseUrl,
        auth: credentials.token,
        request: { timeout: 10000 }
      });
    } else if (credentials.appId && credentials.privateKey && credentials.installationId) {
      // Use GitHub App auth
      octokit = new Octokit({
        baseUrl,
        authStrategy: createAppAuth,
        auth: {
          appId: credentials.appId,
          privateKey: credentials.privateKey,
          installationId: credentials.installationId
        },
        request: { timeout: 10000 }
      });
    } else {
      throw new Error('Invalid GitHub credentials');
    }
    
    // Results tracking
    const results = {
      created: {
        orgs: 0,
        teams: 0,
        repos: 0
      },
      updated: {
        orgs: 0,
        teams: 0,
        repos: 0
      },
      errors: [] as string[]
    };
    
    // Process the hierarchy
    await processHierarchyNode(hierarchyRoot, null, octokit, results);
    
    // Return success response
    context.res = {
      status: 200,
      body: {
        success: true,
        data: {
          results
        }
      } as ApiResponse<any>
    };
    
  } catch (error) {
    context.log.error('Error in exportHierarchy function:', error);
    
    // Return error response
    context.res = {
      status: 500,
      body: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      } as ApiResponse<any>
    };
  }
};

/**
 * Process a hierarchy node and create/update corresponding GitHub resources
 */
async function processHierarchyNode(
  node: HierarchyNode, 
  parentNode: HierarchyNode | null,
  octokit: Octokit,
  results: { created: any, updated: any, errors: string[] }
): Promise<void> {
  try {
    // Handle node based on type
    switch (node.Type) {
      case 'SE':
        // Root node, process children
        for (const child of node.Children) {
          await processHierarchyNode(child, node, octokit, results);
        }
        break;
        
      case 'SB':
        // Organization node
        try {
          // Check if org exists
          try {
            await octokit.orgs.get({ org: node.Name });
            // Org exists, update it if needed
            await octokit.orgs.update({
              org: node.Name,
              name: node.Name,
              description: `Sovereign Branch: ${node.Name}`
            });
            results.updated.orgs++;
          } catch (err) {
            // Org doesn't exist, create it if we can
            // Note: Creating organizations typically requires higher privileges
            // This is often a manual process or requires Enterprise admin
            results.errors.push(`Cannot create organization ${node.Name} - may require manual creation`);
          }
          
          // Process children
          for (const child of node.Children) {
            await processHierarchyNode(child, node, octokit, results);
          }
        } catch (err) {
          results.errors.push(`Error processing organization ${node.Name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        break;
        
      case 'SD':
      case 'IGO':
      case 'EIC':
      case 'CG':
        // Team node
        try {
          if (!parentNode || (parentNode.Type !== 'SB' && parentNode.Type !== 'SD' && 
              parentNode.Type !== 'IGO' && parentNode.Type !== 'EIC' && parentNode.Type !== 'CG')) {
            throw new Error(`Invalid parent node type for team: ${parentNode?.Type}`);
          }
          
          const orgName = getOrgNameFromAncestors(node, parentNode);
          
          if (!orgName) {
            throw new Error('Could not determine organization for team');
          }
          
          // Extract team ID if it exists
          const existingTeamId = node.ID.startsWith('team-') ? parseInt(node.ID.replace('team-', '')) : null;
          
          // See if the team already exists
          const parentTeamId = parentNode.Type !== 'SB' && parentNode.ID.startsWith('team-') 
            ? parseInt(parentNode.ID.replace('team-', '')) 
            : null;
          
          if (existingTeamId) {
            try {
              // Try to update existing team
              await octokit.teams.updateInOrg({
                org: orgName,
                team_slug: node.Name.toLowerCase().replace(/\s+/g, '-'),
                name: node.Name,
                description: `Team type: ${node.Type}`,
                parent_team_id: parentTeamId
              });
              results.updated.teams++;
            } catch (err) {
              // Team doesn't exist or can't be updated
              await createTeam(orgName, node, parentTeamId, octokit);
              results.created.teams++;
            }
          } else {
            // Create new team
            await createTeam(orgName, node, parentTeamId, octokit);
            results.created.teams++;
          }
          
          // Process children
          for (const child of node.Children) {
            await processHierarchyNode(child, node, octokit, results);
          }
        } catch (err) {
          results.errors.push(`Error processing team ${node.Name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        break;
        
      case 'ENTITY':
        // Repository node
        try {
          if (!parentNode || (parentNode.Type !== 'SD' && parentNode.Type !== 'IGO' && 
              parentNode.Type !== 'EIC' && parentNode.Type !== 'CG')) {
            throw new Error(`Invalid parent node type for repository: ${parentNode?.Type}`);
          }
          
          const orgName = getOrgNameFromAncestors(node, parentNode);
          
          if (!orgName) {
            throw new Error('Could not determine organization for repository');
          }
          
          // Check if repo exists
          try {
            await octokit.repos.get({
              owner: orgName,
              repo: node.Name
            });
            
            // Repo exists, update if needed
            await octokit.repos.update({
              owner: orgName,
              repo: node.Name,
              name: node.Name,
              description: `Repository managed by Absolute Realms`
            });
            results.updated.repos++;
          } catch (err) {
            // Repo doesn't exist, create it
            await octokit.repos.createInOrg({
              org: orgName,
              name: node.Name,
              description: `Repository managed by Absolute Realms`,
              private: true,
              auto_init: true
            });
            results.created.repos++;
            
            // Add team to this repo if parent is a team
            if (parentNode.ID.startsWith('team-')) {
              const teamSlug = parentNode.Name.toLowerCase().replace(/\s+/g, '-');
              
              await octokit.teams.addOrUpdateRepoPermissionsInOrg({
                org: orgName,
                team_slug: teamSlug,
                owner: orgName,
                repo: node.Name,
                permission: 'admin'
              });
            }
          }
        } catch (err) {
          results.errors.push(`Error processing repo ${node.Name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        break;
        
      default:
        results.errors.push(`Unknown node type: ${node.Type}`);
    }
  } catch (error) {
    results.errors.push(`Error processing node ${node.Name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Helper function to create a team in GitHub
 */
async function createTeam(
  orgName: string, 
  node: HierarchyNode, 
  parentTeamId: number | null,
  octokit: Octokit
): Promise<void> {
  const params: any = {
    org: orgName,
    name: node.Name,
    description: `Team type: ${node.Type}`,
    privacy: 'closed'
  };
  
  if (parentTeamId) {
    params.parent_team_id = parentTeamId;
  }
  
  await octokit.teams.create(params);
}

/**
 * Find the organization name by traversing up the hierarchy
 */
function getOrgNameFromAncestors(node: HierarchyNode, parentNode: HierarchyNode): string | null {
  // If parent is an org, use its name
  if (parentNode.Type === 'SB') {
    return parentNode.Name;
  }
  
  // Otherwise, extract from ID (org-XXX format)
  const orgIdMatch = parentNode.ID.match(/^org-(\d+)$/);
  if (orgIdMatch) {
    return parentNode.Name;
  }
  
  // For other node types, we need to have this information in the node itself
  // or derive it from context, which is implementation-specific
  return null;
}

export default exportHierarchyFunction;