# UC-010: Extend Blockchain Configuration with Bridging (CCIP, etc.)

**Purpose:**  
Demonstrate that the blockchain configuration can be extended to include bridging settings for protocols such as CCIP.

**Steps:**  
1. Open the config file (e.g., `besu-config.json`) and add a bridging section:
   ```json
   {
     "network": "dev",
     "consensus": "ibft2",
     "bridging": {
       "enableCCIP": true,
       "ccipNodeUrl": "https://ccip.yourdomain.net"
     }
   }
   ```
2. Save the file.
3. Run the deployment command:
   ```bash
   yarn workspace blockchain-config deploy-besu --config ./config/besu-config.json
   ```
4. Verify that the output confirms initialization of CCIP bridging.

**Expected Output:**  
Console output confirming that bridging configurations have been applied and the system has initialized the connection.