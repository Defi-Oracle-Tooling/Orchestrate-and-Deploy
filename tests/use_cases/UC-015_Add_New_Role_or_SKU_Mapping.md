# UC-015: Add New Role or SKU Mapping

**Purpose:**  
Extend the quota logic by introducing a new Azure SKU or node role and verifying the updated logic.

**Steps:**  
1. Edit the CSV file `QuotaUsage_2025-04-04T14_42_52.csv` to add a new row, for example:
   ```csv
   northcentralus,Standard_NC6s_v3,60,30,gpu_ai_node
   ```
2. Regenerate the YAML mapping:
   ```bash
   yarn workspace orchestrator-engine generate-mapping
   ```
3. Validate the new mapping via CLI:
   ```bash
   validate-quota northcentralus gpu_ai_node
   ```
4. Query via API if desired:
   ```bash
   curl "http://localhost:3000/api/quotas?region=northcentralus&role=gpu_ai_node"
   ```

**Expected Output:**  
- YAML mapping now includes the new SKU and role.  
- Validation confirms the new role is recognized and returns the correct status.