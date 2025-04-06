# UC-005: Display Quota Matrix in the Web UI

**Purpose:**  
Render an interactive matrix in the front-end displaying quota usage across regions and node roles.

**Steps:**  
1. Start the front-end development server:
   ```bash
   yarn workspace front-end start
   ```
2. Open your browser and navigate to:
   `http://localhost:8080`
3. Verify that the Quota Matrix is rendered:
   - Columns represent regions.
   - Rows represent node roles.
   - Cells display usage in a colored format (e.g., green for low usage, yellow for moderate, red for high).

**Expected Output:**  
A clear, interactive table showing quota details.