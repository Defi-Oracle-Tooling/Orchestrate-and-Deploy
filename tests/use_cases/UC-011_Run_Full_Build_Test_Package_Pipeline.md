# UC-011: Run Full Build, Test, and Package Pipeline

**Purpose:**  
Ensure that the entire solution builds, passes all tests, generates documentation, and packages into a ZIP archive.

**Steps:**  
1. From the monorepo root, run:
   ```bash
   yarn package-all
   ```
2. Monitor the output for:
   - Dependency installation.
   - Successful build of all packages.
   - All tests passing.
   - Documentation generation.
   - Creation of `full-solution.zip` in the scripts directory.

**Expected Output:**  
A final ZIP archive (`full-solution.zip`) containing the complete solution with code, tests, and docs.