# UC-014: Enforce Version Control on All Configurations

**Purpose:**  
Confirm that every change to blockchain configurations is tracked with versioning and can be rolled back.

**Steps:**  
1. Deploy a configuration using:
   ```bash
   yarn workspace blockchain-config deploy-besu --config ./config/besu-config.json
   ```
2. Modify the configuration file (e.g., change network from "dev" to "prod").
3. Redeploy the updated configuration.
4. Check the `/versions/` directory in the blockchain-config package to see multiple timestamped config files.
5. Attempt a rollback:
   ```bash
   yarn workspace blockchain-config rollback --version <previous-version-label>
   ```

**Expected Output:**  
- The `/versions/` directory contains multiple versioned configuration files.  
- The rollback command successfully reverts to a previous version.