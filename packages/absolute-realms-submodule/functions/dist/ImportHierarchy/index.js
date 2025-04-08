"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const rest_1 = require("@octokit/rest");
const auth_app_1 = require("@octokit/auth-app");
const KeyVaultService_1 = require("../KeyVaultService");
/**
 * Azure Function to import the hierarchy from GitHub Enterprise
 */
const importHierarchyFunction = function (context, req) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        context.log('Processing import hierarchy request');
        try {
            // Get GitHub credentials from Key Vault
            const keyVaultService = new KeyVaultService_1.KeyVaultService();
            const credentials = yield keyVaultService.getGitHubCredentials();
            // Get GitHub Enterprise API URL from request or environment
            const baseUrl = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.baseUrl) ||
                ((_b = req.query) === null || _b === void 0 ? void 0 : _b.baseUrl) ||
                process.env.GITHUB_API_URL ||
                'https://api.github.com';
            // Initialize Octokit with appropriate auth
            let octokit;
            if (credentials.token) {
                // Use token-based auth
                octokit = new rest_1.Octokit({
                    baseUrl,
                    auth: credentials.token,
                    request: { timeout: 10000 }
                });
            }
            else if (credentials.appId && credentials.privateKey && credentials.installationId) {
                // Use GitHub App auth
                octokit = new rest_1.Octokit({
                    baseUrl,
                    authStrategy: auth_app_1.createAppAuth,
                    auth: {
                        appId: credentials.appId,
                        privateKey: credentials.privateKey,
                        installationId: credentials.installationId
                    },
                    request: { timeout: 10000 }
                });
            }
            else {
                throw new Error('Invalid GitHub credentials');
            }
            // Fetch data from GitHub
            const organizationsData = yield octokit.orgs.list({
                per_page: 100
            });
            const organizations = organizationsData.data;
            // Create the root SE node
            const rootNode = {
                ID: 'se-root',
                Parent: '',
                Type: 'SE',
                Name: 'Structured Enterprise',
                Children: []
            };
            // Process organizations (Sovereign Branches)
            for (const org of organizations) {
                const orgNode = {
                    ID: `org-${org.id}`,
                    Parent: rootNode.ID,
                    Type: 'SB',
                    Name: org.login,
                    Children: []
                };
                // Fetch teams for this organization
                const teamsData = yield octokit.teams.list({
                    org: org.login,
                    per_page: 100
                });
                // Map to track teams for parent-child relationships
                const teamNodesMap = new Map();
                // First pass: create all team nodes without establishing parent-child relationships
                for (const team of teamsData.data) {
                    const teamNode = {
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
                            }
                            else {
                                // If parent team not found, attach to org
                                orgNode.Children.push(teamNode);
                            }
                        }
                        else {
                            // Top-level team, attach to org
                            orgNode.Children.push(teamNode);
                        }
                        // Fetch repositories for this team
                        const reposData = yield octokit.teams.listReposInOrg({
                            org: org.login,
                            team_slug: team.slug,
                            per_page: 100
                        });
                        // Add repositories as children of the team
                        for (const repo of reposData.data) {
                            const repoNode = {
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
                }
            };
        }
        catch (error) {
            context.log.error('Error in importHierarchy function:', error);
            // Return error response
            context.res = {
                status: 500,
                body: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            };
        }
    });
};
/**
 * Determine the node type based on team name
 */
function getTeamType(teamName) {
    teamName = teamName.toLowerCase();
    if (teamName.includes('department') || teamName.includes('dept')) {
        return 'SD';
    }
    else if (teamName.includes('igo') || teamName.includes('intergovernmental')) {
        return 'IGO';
    }
    else if (teamName.includes('eic') || teamName.includes('enterprise independent corporation')) {
        return 'EIC';
    }
    else if (teamName.includes('cg') || teamName.includes('corporate governance')) {
        return 'CG';
    }
    else {
        return 'SD'; // Default to sovereign department
    }
}
exports.default = importHierarchyFunction;
//# sourceMappingURL=index.js.map