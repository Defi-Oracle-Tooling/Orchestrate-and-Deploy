# Absolute Realms Hierarchy Structure

This document provides details on the hierarchical structure of Absolute Realms, used for organizational management within our GitHub Enterprise environment.

## Hierarchy Overview

The Absolute Realms hierarchy follows a structured governance model that organizes entities into branches, ministries, departments, and operational units. This structure enables efficient management of GitHub Enterprise resources, permissions, and workflows.

## Structure Types

| Type Code | Type Name | Description |
|-----------|-----------|-------------|
| SE | Supreme Entity | The top-level entity (Absolute Realms) |
| SB | Sovereign Branch | Major organizational divisions (Executive, Parliamentary, Judicial) |
| SD | Subordinate Division | Ministries and departments that handle specific functions |
| IGO | Inter-Governmental Organization | Cross-functional entities that operate across departments |
| EIC | Enterprise Integration Class | Classification groups for different entity types |
| CG | Cooperative Group | Collections of related entities that work together |
| ENTITY | Individual Entity | Smallest organizational unit in the hierarchy |

## Hierarchy Implementation

In GitHub Enterprise, this hierarchy is implemented as follows:

- **Supreme Entity (SE)**: Maps to the GitHub Enterprise instance
- **Sovereign Branches (SB)**: Implemented as top-level GitHub Organizations
- **Subordinate Divisions (SD)**: Sub-organizations or major repository groups
- **IGOs**: Cross-organization teams with defined access patterns
- **EICs**: Custom repository classifications implemented through topics and metadata
- **Cooperative Groups (CG)**: Teams within GitHub Organizations
- **Individual Entities**: Individual repositories or projects

## Integration with Hierarchical Chart

The React-based Hierarchical Chart in this submodule visualizes this structure, allowing administrators to:

1. View the complete organizational hierarchy
2. Drill down into specific branches and departments
3. Edit entity relationships and properties
4. Provision new GitHub repositories and teams based on the hierarchy

## Example Hierarchy

Below is a simplified example of the Absolute Realms hierarchy:

```
Absolute Realms (SE)
├── Executive Branch (SB)
│   ├── Ministry of Finance (SD)
│   │   ├── Department of Realms Treasury (SD)
│   │   │   └── ELEMENTAL IMPERIUM (IGO)
│   │   │       ├── Class 1 (Cooperatives) (EIC)
│   │   │       │   ├── Cooperative A (CG)
│   │   │       │   │   ├── Entity 1 (ENTITY)
│   │   │       │   │   └── Entity 2 (ENTITY)
│   │   │       │   └── Cooperative B (CG)
│   │   │       └── Class 2 (Cooperatives) (EIC)
│   │   └── Department of External Treasury (SD)
│   │       └── ILLYRIAN STATES ALLIANCE (IGO)
├── Parliamentary Branch (SB)
└── Judicial Branch (SB)
```

## Mapping to GitHub Enterprise

When implementing this structure in GitHub Enterprise:

1. Create organizations for each Sovereign Branch (SB)
2. Within each organization, create team structures for Subordinate Divisions (SD)
3. Use repository topics and metadata to implement EIC classifications
4. Create nested teams for Cooperative Groups and their entities
5. Apply appropriate permission settings and branch protection rules

For details on implementing these mappings, see the [GitHub Enterprise Setup Guide](../setup/github-enterprise-setup.md).

## Best Practices

- Maintain consistent naming conventions across the hierarchy
- Implement CODEOWNERS files that align with the organizational structure
- Use branch protection rules that enforce appropriate review processes
- Configure webhook integrations to automate cross-entity workflows
- Regularly audit permissions to ensure alignment with the hierarchy