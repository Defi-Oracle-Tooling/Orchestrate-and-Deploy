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
 * Azure Function to import the hierarchy from GitHub Enterprise
 */
const importHierarchyFunction: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  context.log('Processing import hierarchy request');
  
  try {
    // Get GitHub credentials from Key Vault
    const keyVaultService = new KeyVaultService();
    const credentials = await keyVaultService.getGitHubCredentials();
    
    // Get GitHub Enterprise API URL from request or environment
    const baseUrl = req.body?.baseUrl || 
                   req.query?.baseUrl || 
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
    
    // Fetch data from GitHub
    const organizationsData = await octokit.orgs.list({
      per_page: 100
    });
    
    const organizations = organizationsData.data;
    
    // Create the root SE node
    const rootNode: HierarchyNode = {
      ID: 'se-root',
      Parent: '',
      Type: 'SE',
      Name: 'Structured Enterprise',
      Children: []
    };
    
    // Process organizations (Sovereign Branches)
    for (const org of organizations) {
      const orgNode: HierarchyNode = {
        ID: `org-${org.id}`,
        Parent: rootNode.ID,
        Type: 'SB',
        Name: org.login,
        Children: []
      };
      
      // Fetch teams for this organization
      const teamsData = await octokit.teams.list({
        org: org.login,
        per_page: 100
      });
      
      // Map to track teams for parent-child relationships
      const teamNodesMap = new Map<number, HierarchyNode>();
      
      // First pass: create all team nodes without establishing parent-child relationships
      for (const team of teamsData.data) {
        const teamNode: HierarchyNode = {
          ID: `team-${team.id}`,
          Parent: team.parent ? `team-${team.parent.id}` : orgNode.ID,
          Type: getTeamType(team.name),
          Name: team.name,
          Children: []
        };
        
        teamNodesMap.set(team.id, teamNode);
      }
      
      // Second pass: establish parent-child relationships
      for (const team of teamsData.data) {
        const teamNode = teamNodesMap.get(team.id);
        
        if (teamNode) {
          if (team.parent) {
            const parentTeamNode = teamNodesMap.get(team.parent.id);
            if (parentTeamNode) {
              // Add this team as a child of the parent team
              parentTeamNode.Children.push(teamNode);
            } else {
              // If parent team not found, attach to org
              orgNode.Children.push(teamNode);
            }
          } else {
            // Top-level team, attach to org
            orgNode.Children.push(teamNode);
          }
          
          // Fetch repositories for this team
          const reposData = await octokit.teams.listReposInOrg({
            org: org.login,
            team_slug: team.slug,
            per_page: 100
          });
          
          // Add repositories as children of the team
          for (const repo of reposData.data) {
            const repoNode: HierarchyNode = {
              ID: `repo-${repo.id}`,
              Parent: teamNode.ID,
              Type: 'ENTITY',
              Name: repo.name,
              Children: []
            };
            
            teamNode.Children.push(repoNode);
          }
        }
      }
      
      // Add the organization node to the root
      rootNode.Children.push(orgNode);
    }
    
    // Return the hierarchy
    context.res = {
      status: 200,
      body: {
        success: true,
        data: {
          hierarchy: rootNode
        }
      } as ApiResponse<any>
    };
    
  } catch (error) {
    context.log.error('Error in importHierarchy function:', error);
    
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
 * Determine the node type based on team name
 */
function getTeamType(teamName: string): string {
  teamName = teamName.toLowerCase();
  
  if (teamName.includes('department') || teamName.includes('dept')) {
    return 'SD';
  } else if (teamName.includes('igo') || teamName.includes('intergovernmental')) {
    return 'IGO';
  } else if (teamName.includes('eic') || teamName.includes('enterprise independent corporation')) {
    return 'EIC';
  } else if (teamName.includes('cg') || teamName.includes('corporate governance')) {
    return 'CG';
  } else {
    return 'SD'; // Default to sovereign department
  }
}

export default importHierarchyFunction;