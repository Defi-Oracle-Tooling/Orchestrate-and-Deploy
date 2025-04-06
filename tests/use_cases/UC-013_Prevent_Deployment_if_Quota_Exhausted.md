# UC-013: Prevent Deployment if Quota is Exhausted

**Purpose:**  
Ensure that the system prevents node deployments when no quota is available for a given role.

**Steps:**  
1. Modify the CSV to simulate exhausted quota for a role (e.g., set `used` equal to `total` for a role).
2. Regenerate the YAML mapping:
   ```bash
   yarn workspace orchestrator-engine generate-mapping
   ```
3. Run the validation command:
   ```bash
   validate-quota someRegion exhaustedRole
   ```
4. Alternatively, query the API:
   ```bash
   curl "http://localhost:3000/api/quotas?region=someRegion&role=exhaustedRole"
   ```

**Expected Output:**  
- CLI command returns false.  
- API returns an empty or filtered response, indicating no available quota.