# UC-003: Suggest a Region for Node Deployment

**Purpose:**  
Automatically suggest an alternative region with available quota for a specified node role.

**Steps:**  
1. In the orchestrator CLI (or via API), run:
   ```bash
   suggest-region validator
   ```
2. Alternatively, call via REST API:
   ```bash
   curl http://localhost:3000/api/quotas/suggestions/validator
   ```
3. Check that the output returns the name of a region (e.g., eastus) where the role has available quota.

**Expected Output:**  
The first region found that satisfies the quota requirements (e.g., eastus), or a message indicating no region is available.