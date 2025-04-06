# UC-012: Trigger Nightly Quota Refresh

**Purpose:**  
Verify that the scheduled automation (or manual trigger) correctly regenerates the YAML mapping from the CSV quota data.

**Steps:**  
1. **Manual Trigger:**  
   In your terminal, run:
   ```bash
   yarn workspace orchestrator-engine generate-mapping
   ```
2. **Automated Trigger:**  
   Verify that the GitHub Action defined in `scripts/nightly-quota-refresh.yml` is scheduled correctly.
3. Check the updated `live-quotas.yaml` file for current quota data.

**Expected Output:**  
Updated YAML mapping reflecting the latest quota data.