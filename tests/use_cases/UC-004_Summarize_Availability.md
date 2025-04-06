# UC-004: Summarize Quota Availability for a Role

**Purpose:**  
Provide usage statistics (total, used, available, usage percentage) across regions for a specified node role.

**Steps:**  
1. Run the CLI command:
   ```bash
   summarize-availability validator
   ```
2. Review the output, which should be a JSON-like summary:
   ```json
   {
     "eastus": {
       "total": 128,
       "used": 96,
       "available": 32,
       "usage_percent": "75.00"
     }
   }
   ```

**Expected Output:**  
A summary object that aggregates quota usage for the role validator across all regions.