# Full Automated Orchestration & Hyperledger Besu Integration

This monorepo contains:

1. **blockchain-config**  
   A tool that automates configuration, updating, and deployment of Hyperledger Besu nodes, 
   with easy extension to Hyperledger Cacti, Hyperledger Firefly, and bridging protocols (e.g., CCIP).

2. **orchestrator-engine**  
   A quota-aware orchestration engine that:
   - Parses Azure quota usage from a CSV,
   - Generates a YAML-based mapping,
   - Offers rule-based logic (validation, suggestion),
   - Provides REST APIs and CLI for orchestration tasks.

3. **front-end**  
   A React + TypeScript application that includes:
   - An interactive QuotaMatrix component showing region/node quota usage,
   - A Visual Config Tool for XML/JSON-based configuration with versioning and rollback.

4. **scripts**  
   Utility scripts, including GitHub Actions for nightly quota refresh, build, test, and packaging.

## Key Features

- **Parallel Task Execution**  
  Code generation, configuration updates, integration, testing, and documentation can run in parallel.
- **Comprehensive Testing**  
  Each package includes its own unit/integration tests. 
- **Documentation Generation**  
  All code is documented for easy reference.
- **Final Packaging**  
  A single command (`yarn package-all`) builds and tests everything, 
  then packages the entire codebase (including docs) into a `.zip` for download.

See the individual package folders for more details.

## Setup Instructions

1. **Install Dependencies**
   - Ensure you have Node.js (v16 or later) and pnpm installed.
   - Run `pnpm install` in the root directory to install all dependencies.

2. **Environment Configuration**
   - Create a `.env` file in the root directory with the required environment variables. Refer to the individual package documentation for specific variables.

3. **Build the Project**
   - Run `pnpm build` to compile all packages.

4. **Run Tests**
   - Execute `pnpm test` to run all unit and integration tests.

5. **Start the Application**
   - Use `pnpm start` to start the backend and frontend services.

## Usage Examples

- **Generate YAML Mapping**:
  ```bash
  pnpm run generate-yaml --input ./path/to/csv --output ./path/to/output.yaml
  ```

- **Validate Quota**:
  ```bash
  pnpm run validate-quota --region eastus --role contributor
  ```

- **Start Frontend**:
  ```bash
  pnpm --filter front-end start
  ```

## Contribution Guidelines

1. Fork the repository and create a new branch for your feature or bug fix.
2. Ensure your code follows the project's linting and formatting rules.
3. Write unit tests for any new functionality.
4. Submit a pull request with a detailed description of your changes.

## Troubleshooting

- **Dependency Issues**:
  - Run `pnpm install --force` to resolve dependency conflicts.

- **Build Failures**:
  - Ensure all environment variables are correctly set.
  - Check the logs for specific error messages.

- **Test Failures**:
  - Verify that your local environment matches the test environment requirements.

For further assistance, please open an issue in the repository.