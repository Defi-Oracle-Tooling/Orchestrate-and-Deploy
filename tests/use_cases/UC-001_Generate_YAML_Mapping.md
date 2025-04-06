# UC-001: Generate YAML Mapping from Azure Quota CSV

**Purpose:**  
Confirm that the orchestrator correctly parses Azure quota data from a CSV file and outputs a normalized YAML mapping.

**Prerequisites:**  
- CSV file is placed at:  
  `monorepo/packages/orchestrator-engine/data/quotas/QuotaUsage_2025-04-04T14_42_52.csv`

**Steps:**  
1. Open the VS Code terminal in the root of the monorepo.
2. Run the command:
   ```bash
   yarn workspace orchestrator-engine generate-mapping
   ```
3. Open the generated file at:
   `monorepo/packages/orchestrator-engine/data/quotas/live-quotas.yaml`
4. Verify that the YAML structure looks similar to:
   ```yaml
   eastus:
     DSv4:
       total: 128
       used: 96
       available: 32
       assigned_to:
         - validator
   ```

**Expected Output:**  
A properly formatted live-quotas.yaml file reflecting the quota data.