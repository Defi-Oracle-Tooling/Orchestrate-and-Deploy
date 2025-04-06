# UC-002: Validate Deployment Eligibility for a Role in a Region

**Purpose:**  
Ensure the orchestrator (via CLI or API) correctly validates quota availability for deploying a node in a specified region.

**CLI Testing Steps:**  
1. Start the orchestrator engine (if not already running):
   ```bash
   yarn workspace orchestrator-engine start
   ```
2. In the CLI, type:
   ```bash
   validate-quota eastus validator
   ```
3. Observe the output (should be true if the quota is available, otherwise false).

**API Testing Steps:**  
1. Open your browser or API client and navigate to:
   `http://localhost:3000/api/quotas?region=eastus&role=validator`
2. Verify that the response shows quota details for the given region and role.

**Expected Output:**  
- CLI returns true or false based on available quota.  
- API returns a JSON object with quota details.