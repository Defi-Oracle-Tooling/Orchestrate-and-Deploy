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
 * Azure Function to export hierarchy to GitHub Enterprise
 */
const exportHierarchyFunction = function (context, req) {
    return __awaiter(this, void 0, void 0, function* () {
        context.log('Processing export hierarchy request');
        try {
            // Validate request
            if (!req.body || !req.body.hierarchy) {
                throw new Error('Request body must contain a hierarchy object');
            }
            const hierarchyRoot = req.body.hierarchy;
            // Get GitHub credentials from Key Vault
            const keyVaultService = new KeyVaultService_1.KeyVaultService();
            const credentials = yield keyVaultService.getGitHubCredentials();
            // Get GitHub Enterprise API URL from request or environment
            const baseUrl = req.body.baseUrl ||
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
                errors: []
            };
            // Process the hierarchy
            yield processHierarchyNode(hierarchyRoot, null, octokit, results);
            // Return success response
            context.res = {
                status: 200,
                body: {
                    success: true,
                    data: {
                        results
                    }
                }
            };
        }
        catch (error) {
            context.log.error('Error in exportHierarchy function:', error);
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
 * Process a hierarchy node and create/update corresponding GitHub resources
 */
function processHierarchyNode(node, parentNode, octokit, results) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Handle node based on type
            switch (node.Type) {
                case 'SE':
                    // Root node, process children
                    for (const child of node.Children) {
                        yield processHierarchyNode(child, node, octokit, results);
                    }
                    break;
                case 'SB':
                    // Organization node
                    try {
                        // Check if org exists
                        try {
                            yield octokit.orgs.get({ org: node.Name });
                            // Org exists, update it if needed
                            yield octokit.orgs.update({
                                org: node.Name,
                                name: node.Name,
                                description: `Sovereign Branch: ${node.Name}`
                            });
                            results.updated.orgs++;
                        }
                        catch (err) {
                            // Org doesn't exist, create it if we can
                            // Note: Creating organizations typically requires higher privileges
                            // This is often a manual process or requires Enterprise admin
                            results.errors.push(`Cannot create organization ${node.Name} - may require manual creation`);
                        }
                        // Process children
                        for (const child of node.Children) {
                            yield processHierarchyNode(child, node, octokit, results);
                        }
                    }
                    catch (err) {
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
                            throw new Error(`Invalid parent node type for team: ${parentNode === null || parentNode === void 0 ? void 0 : parentNode.Type}`);
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
                                yield octokit.teams.updateInOrg({
                                    org: orgName,
                                    team_slug: node.Name.toLowerCase().replace(/\s+/g, '-'),
                                    name: node.Name,
                                    description: `Team type: ${node.Type}`,
                                    parent_team_id: parentTeamId
                                });
                                results.updated.teams++;
                            }
                            catch (err) {
                                // Team doesn't exist or can't be updated
                                yield createTeam(orgName, node, parentTeamId, octokit);
                                results.created.teams++;
                            }
                        }
                        else {
                            // Create new team
                            yield createTeam(orgName, node, parentTeamId, octokit);
                            results.created.teams++;
                        }
                        // Process children
                        for (const child of node.Children) {
                            yield processHierarchyNode(child, node, octokit, results);
                        }
                    }
                    catch (err) {
                        results.errors.push(`Error processing team ${node.Name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                    }
                    break;
                case 'ENTITY':
                    // Repository node
                    try {
                        if (!parentNode || (parentNode.Type !== 'SD' && parentNode.Type !== 'IGO' &&
                            parentNode.Type !== 'EIC' && parentNode.Type !== 'CG')) {
                            throw new Error(`Invalid parent node type for repository: ${parentNode === null || parentNode === void 0 ? void 0 : parentNode.Type}`);
                        }
                        const orgName = getOrgNameFromAncestors(node, parentNode);
                        if (!orgName) {
                            throw new Error('Could not determine organization for repository');
                        }
                        // Check if repo exists
                        try {
                            yield octokit.repos.get({
                                owner: orgName,
                                repo: node.Name
                            });
                            // Repo exists, update if needed
                            yield octokit.repos.update({
                                owner: orgName,
                                repo: node.Name,
                                name: node.Name,
                                description: `Repository managed by Absolute Realms`
                            });
                            results.updated.repos++;
                        }
                        catch (err) {
                            // Repo doesn't exist, create it
                            yield octokit.repos.createInOrg({
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
                                yield octokit.teams.addOrUpdateRepoPermissionsInOrg({
                                    org: orgName,
                                    team_slug: teamSlug,
                                    owner: orgName,
                                    repo: node.Name,
                                    permission: 'admin'
                                });
                            }
                        }
                    }
                    catch (err) {
                        results.errors.push(`Error processing repo ${node.Name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                    }
                    break;
                default:
                    results.errors.push(`Unknown node type: ${node.Type}`);
            }
        }
        catch (error) {
            results.errors.push(`Error processing node ${node.Name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}
/**
 * Helper function to create a team in GitHub
 */
function createTeam(orgName, node, parentTeamId, octokit) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = {
            org: orgName,
            name: node.Name,
            description: `Team type: ${node.Type}`,
            privacy: 'closed'
        };
        if (parentTeamId) {
            params.parent_team_id = parentTeamId;
        }
        yield octokit.teams.create(params);
    });
}
/**
 * Find the organization name by traversing up the hierarchy
 */
function getOrgNameFromAncestors(node, parentNode) {
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
exports.default = exportHierarchyFunction;
//# sourceMappingURL=index.js.map