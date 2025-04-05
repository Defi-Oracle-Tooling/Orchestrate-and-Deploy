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