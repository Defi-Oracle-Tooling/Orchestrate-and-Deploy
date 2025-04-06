# UC-008: Deploy Hyperledger Besu with Custom Config

**Purpose:**  
Validate that the Besu configurator tool correctly deploys or updates nodes using a custom configuration file.

**Steps:**  
1. Ensure you have a valid config file (e.g., `monorepo/packages/blockchain-config/config/besu-config.json`).
2. Run the command:
   ```bash
   yarn workspace blockchain-config deploy-besu --config ./config/besu-config.json
   ```
3. Observe console output for messages such as:
   - Config parsing confirmation.
   - Versioned config file saved in the versions folder.
   - Deployment success message.

**Expected Output:**  
Confirmation messages indicating successful deployment and version tracking.