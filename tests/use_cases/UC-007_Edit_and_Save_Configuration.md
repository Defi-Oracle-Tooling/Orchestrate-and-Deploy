# UC-007: Edit and Save a Configuration in JSON/XML

**Purpose:**  
Test the Visual Configuration Tool to edit and save configurations with version tracking.

**Steps:**  
1. Start the front-end (if not already running):
   ```bash
   yarn workspace front-end start
   ```
2. Navigate to the “Visual Configuration Tool” section in the UI.
3. Select a format (JSON or XML) from the dropdown.
4. Enter or edit a sample configuration (e.g., modify a JSON object):
   ```json
   {
     "network": "prod",
     "consensus": "ibft2"
   }
   ```
5. Click the Save Config button.
6. An alert should confirm the configuration was “saved” (placeholder for future backend integration).

**Expected Output:**  
An alert confirming the saved configuration with a preview of the JSON/XML content.