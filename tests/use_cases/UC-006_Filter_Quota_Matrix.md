# UC-006: Filter Quota Matrix by Region or Node Role

**Purpose:**  
Verify that the matrix filters dynamically update based on user inputs.

**Steps:**  
1. With the front-end running (see UC-005), locate the filter inputs above the matrix.
2. Type a region name (e.g., `westus`) in the "Filter by Region" input.
3. Type a role (e.g., `validator`) in the "Filter by Role" input.
4. Observe that the matrix updates to display only the relevant quota data.

**Expected Output:**  
The matrix re-renders, displaying only rows and columns matching the specified filters.