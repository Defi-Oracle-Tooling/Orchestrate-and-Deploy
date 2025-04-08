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
exports.KeyVaultService = void 0;
const identity_1 = require("@azure/identity");
const keyvault_secrets_1 = require("@azure/keyvault-secrets");
/**
 * Service for interacting with Azure Key Vault
 */
class KeyVaultService {
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
        const credential = new identity_1.DefaultAzureCredential({
            managedIdentityClientId: process.env.AZURE_CLIENT_ID
        });
        this.secretClient = new keyvault_secrets_1.SecretClient(keyVaultUrl, credential);
    }
    /**
     * Gets GitHub credentials from Key Vault
     * @returns GitHub credentials for API authentication
     */
    getGitHubCredentials() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Determine authentication method based on secrets in Key Vault
                const useAppAuth = yield this.secretExists("github-app-id");
                if (useAppAuth) {
                    // Use GitHub App authentication
                    const [appId, privateKey, installationId] = yield Promise.all([
                        this.getSecretValue("github-app-id"),
                        this.getSecretValue("github-private-key"),
                        this.getSecretValue("github-installation-id")
                    ]);
                    return {
                        appId,
                        privateKey,
                        installationId
                    };
                }
                else {
                    // Use PAT authentication
                    const token = yield this.getSecretValue("github-token");
                    return { token };
                }
            }
            catch (error) {
                console.error("Failed to retrieve GitHub credentials from Key Vault:", error);
                throw new Error("Failed to retrieve GitHub credentials from Key Vault");
            }
        });
    }
    /**
     * Checks if a secret exists in Key Vault
     * @param secretName The name of the secret to check
     * @returns True if the secret exists, false otherwise
     */
    secretExists(secretName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.secretClient.getSecret(secretName);
                return true;
            }
            catch (error) {
                // Secret doesn't exist
                return false;
            }
        });
    }
    /**
     * Gets the value of a secret from Key Vault
     * @param secretName The name of the secret to retrieve
     * @returns The secret value
     */
    getSecretValue(secretName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const secret = yield this.secretClient.getSecret(secretName);
                return secret.value || "";
            }
            catch (error) {
                console.error(`Failed to retrieve secret '${secretName}' from Key Vault:`, error);
                throw new Error(`Failed to retrieve secret '${secretName}' from Key Vault`);
            }
        });
    }
    /**
     * Sets a secret in Key Vault
     * @param secretName The name of the secret to set
     * @param secretValue The value of the secret
     */
    setSecret(secretName, secretValue) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.secretClient.setSecret(secretName, secretValue);
            }
            catch (error) {
                console.error(`Failed to set secret '${secretName}' in Key Vault:`, error);
                throw new Error(`Failed to set secret '${secretName}' in Key Vault`);
            }
        });
    }
}
exports.KeyVaultService = KeyVaultService;
//# sourceMappingURL=KeyVaultService.js.map