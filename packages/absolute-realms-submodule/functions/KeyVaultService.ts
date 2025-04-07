import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

/**
 * Interface for GitHub credentials
 */
export interface GitHubCredentials {
    // For PAT authentication
    token?: string;

    // For GitHub App authentication
    appId?: string;
    privateKey?: string;
    installationId?: string;
}

/**
 * Service for interacting with Azure Key Vault
 */
export class KeyVaultService {
    private secretClient: SecretClient;

    /**
     * Initializes a new instance of the KeyVaultService
     */
    constructor() {
        const keyVaultName = process.env.KEY_VAULT_NAME;

        if (!keyVaultName) {
            throw new Error("KEY_VAULT_NAME environment variable is not set");
        }

        const keyVaultUrl = `https://${keyVaultName}.vault.azure.net`;

        // Use Managed Identity for authentication to Key Vault
        const credential = new DefaultAzureCredential({
            managedIdentityClientId: process.env.AZURE_CLIENT_ID
        });

        this.secretClient = new SecretClient(keyVaultUrl, credential);
    }

    /**
     * Gets GitHub credentials from Key Vault
     * @returns GitHub credentials for API authentication
     */
    public async getGitHubCredentials(): Promise<GitHubCredentials> {
        try {
            // Determine authentication method based on secrets in Key Vault
            const useAppAuth = await this.secretExists("github-app-id");

            if (useAppAuth) {
                // Use GitHub App authentication
                const [appId, privateKey, installationId] = await Promise.all([
                    this.getSecretValue("github-app-id"),
                    this.getSecretValue("github-private-key"),
                    this.getSecretValue("github-installation-id")
                ]);

                return {
                    appId,
                    privateKey,
                    installationId
                };
            } else {
                // Use PAT authentication
                const token = await this.getSecretValue("github-token");
                return { token };
            }
        } catch (error) {
            console.error("Failed to retrieve GitHub credentials from Key Vault:", error);
            throw new Error("Failed to retrieve GitHub credentials from Key Vault");
        }
    }

    /**
     * Checks if a secret exists in Key Vault
     * @param secretName The name of the secret to check
     * @returns True if the secret exists, false otherwise
     */
    private async secretExists(secretName: string): Promise<boolean> {
        try {
            await this.secretClient.getSecret(secretName);
            return true;
        } catch (error) {
            // Secret doesn't exist
            return false;
        }
    }

    /**
     * Gets the value of a secret from Key Vault
     * @param secretName The name of the secret to retrieve
     * @returns The secret value
     */
    private async getSecretValue(secretName: string): Promise<string> {
        try {
            const secret = await this.secretClient.getSecret(secretName);
            return secret.value || "";
        } catch (error) {
            console.error(`Failed to retrieve secret '${secretName}' from Key Vault:`, error);
            throw new Error(`Failed to retrieve secret '${secretName}' from Key Vault`);
        }
    }

    /**
     * Sets a secret in Key Vault
     * @param secretName The name of the secret to set
     * @param secretValue The value of the secret
     */
    public async setSecret(secretName: string, secretValue: string): Promise<void> {
        try {
            await this.secretClient.setSecret(secretName, secretValue);
        } catch (error) {
            console.error(`Failed to set secret '${secretName}' in Key Vault:`, error);
            throw new Error(`Failed to set secret '${secretName}' in Key Vault`);
        }
    }
}