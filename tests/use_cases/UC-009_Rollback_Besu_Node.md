# UC-009: Rollback Besu Node to a Previous Configuration

**Purpose:**  
Ensure that the rollback functionality reverts blockchain node configurations to a specified previous version.

**Steps:**  
1. Identify a valid version label from the `/versions/` directory (e.g., `besu-config-2025-04-04-12-34-22`).
2. Run the command:
   ```bash
   yarn workspace blockchain-config rollback --version besu-config-2025-04-04-12-34-22
   ```
3. Check the console output for rollback confirmation.

**Expected Output:**  
A message indicating that the rollback was initiated, along with subsequent deployment of the old configuration.