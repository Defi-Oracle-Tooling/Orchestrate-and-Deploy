import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { GitHubApiConfig, ApiResponse, HierarchyNode } from '../types';

/**
 * Service for interacting with the GitHub Enterprise API
 */
export class GitHubApiService {
    private octokit: Octokit;
    private baseUrl: string;

    constructor(config: GitHubApiConfig) {
        this.baseUrl = config.baseUrl;

        // Initialize Octokit with the appropriate authentication
        if (config.token) {
            // Use personal access token authentication
            this.octokit = new Octokit({
                baseUrl: config.baseUrl,
                auth: config.token,
                request: {
                    timeout: 10000,
                },
            });
        } else if (config.appId && config.privateKey && config.installationId) {
            // Use GitHub App authentication
            const auth = createAppAuth({
                appId: config.appId,
                privateKey: config.privateKey,
                installationId: config.installationId,
            });

            this.octokit = new Octokit({
                baseUrl: config.baseUrl,
                authStrategy: createAppAuth,
                auth: {
                    appId: config.appId,
                    privateKey: config.privateKey,
                    installationId: config.installationId,
                },
                request: {
                    timeout: 10000,
                },
            });
        } else {
            throw new Error('Invalid GitHub API configuration. Must provide either token or appId, privateKey, and installationId.');
        }
    }

    /**
     * Fetches all organizations
     */
    async getOrganizations(): Promise<ApiResponse<any[]>> {
        try {
            const response = await this.octokit.orgs.list({ per_page: 100 });
            return {
                success: true,
                data: response.data,
            };
        } catch (error) {
            console.error('Error fetching organizations:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Fetches details for a specific organization
     */
    async getOrganization(org: string): Promise<ApiResponse<any>> {
        try {
            const response = await this.octokit.orgs.get({ org });
            return {
                success: true,
                data: response.data,
            };
        } catch (error) {
            console.error(`Error fetching organization ${org}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Fetches all teams for an organization
     */
    async getTeams(org: string): Promise<ApiResponse<any[]>> {
        try {
            const response = await this.octokit.teams.list({ org, per_page: 100 });
            return {
                success: true,
                data: response.data,
            };
        } catch (error) {
            console.error(`Error fetching teams for organization ${org}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Creates a new team in an organization
     */
    async createTeam(
        org: string,
        name: string,
        description: string,
        parentTeamId?: number
    ): Promise<ApiResponse<any>> {
        try {
            const response = await this.octokit.teams.create({
                org,
                name,
                description,
                parent_team_id: parentTeamId,
                privacy: 'closed',
            });
            return {
                success: true,
                data: response.data,
            };
        } catch (error) {
            console.error(`Error creating team ${name} in organization ${org}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Imports the GitHub Enterprise structure into a hierarchy
     */
    async importHierarchy(): Promise<ApiResponse<HierarchyNode>> {
        try {
            // Fetch organizations (for Sovereign Branches)
            const orgsResponse = await this.getOrganizations();
            if (!orgsResponse.success || !orgsResponse.data) {
                throw new Error('Failed to fetch organizations');
            }

            // Create root node (Supreme Entity)
            const rootNode: HierarchyNode = {
                ID: '0',
                Parent: 'NA',
                Type: 'SE',
                Name: 'Absolute Realms',
                Children: [],
            };

            // Process each organization as a Sovereign Branch
            for (const org of orgsResponse.data) {
                const orgNode: HierarchyNode = {
                    ID: `org-${org.id}`,
                    Parent: '0',
                    Type: 'SB',
                    Name: org.login,
                    Children: [],
                };

                // Fetch teams for this organization
                const teamsResponse = await this.getTeams(org.login);
                if (teamsResponse.success && teamsResponse.data) {
                    // First pass: collect all teams
                    const teamMap = new Map<number, any>();
                    teamsResponse.data.forEach(team => {
                        teamMap.set(team.id, team);
                    });

                    // Second pass: build hierarchy
                    teamsResponse.data.forEach(team => {
                        if (!team.parent) {
                            // This is a top-level team (Subordinate Division)
                            const teamNode: HierarchyNode = {
                                ID: `team-${team.id}`,
                                Parent: `org-${org.id}`,
                                Type: 'SD',
                                Name: team.name,
                                Children: [],
                            };
                            this.addChildTeams(teamNode, team.id, teamMap);
                            orgNode.Children.push(teamNode);
                        }
                    });
                }

                rootNode.Children.push(orgNode);
            }

            return {
                success: true,
                data: rootNode,
            };
        } catch (error) {
            console.error('Error importing hierarchy:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Recursively adds child teams to a node
     */
    private addChildTeams(
        parentNode: HierarchyNode,
        parentTeamId: number,
        teamMap: Map<number, any>
    ): void {
        // Find all teams that have this team as a parent
        for (const [id, team] of teamMap.entries()) {
            if (team.parent && team.parent.id === parentTeamId) {
                const teamNode: HierarchyNode = {
                    ID: `team-${team.id}`,
                    Parent: parentNode.ID,
                    Type: this.determineTeamType(team.name),
                    Name: team.name,
                    Children: [],
                };

                // Recursively add children
                this.addChildTeams(teamNode, team.id, teamMap);
                parentNode.Children.push(teamNode);
            }
        }
    }

    /**
     * Determines the node type based on team name
     */
    private determineTeamType(teamName: string): string {
        const lowerName = teamName.toLowerCase();
        if (lowerName.includes('ministry')) return 'SD';
        if (lowerName.includes('department')) return 'SD';
        if (lowerName.includes('imperium') || lowerName.includes('alliance')) return 'IGO';
        if (lowerName.includes('class')) return 'EIC';
        if (lowerName.includes('cooperative')) return 'CG';
        return 'ENTITY';
    }

    /**
     * Exports a hierarchy to GitHub Enterprise
     */
    async exportHierarchy(hierarchy: HierarchyNode): Promise<ApiResponse<any>> {
        try {
            // Implementation would need to:
            // 1. Compare the hierarchy with the current GitHub Enterprise structure
            // 2. Create new organizations, teams, and repositories as needed
            // 3. Update existing entities
            // 4. Delete entities that no longer exist in the hierarchy

            // This is a complex operation that would require careful implementation
            // to avoid unintended consequences. For now, we'll just return a success
            // response with a placeholder message.

            return {
                success: true,
                data: { message: 'Hierarchy export not yet implemented' },
            };
        } catch (error) {
            console.error('Error exporting hierarchy:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}