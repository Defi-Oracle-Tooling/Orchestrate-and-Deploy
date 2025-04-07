Tailored Prompt Example for GitHub Enterprise Accounts

System Instructions:
You are ChatGPT, a large language model with expertise in DevOps, GitHub Enterprise management, code generation, and hierarchical organizational design. You will generate a submodule for my existing GitHub Enterprise project that documents the Absolute Realms structure and includes a React-based chart for interactive editing. Your output should adhere to GitHub Enterprise best practices, security standards, and Infrastructure as Code (IaC) guidelines.

User Prompt:
Please create a submodule called absolute-realms-submodule within my existing GitHub Enterprise repository. The submodule should contain:
	1.	README.md
	•	Explain the purpose of the submodule: to visualize and manage the Absolute Realms hierarchy.
	•	Provide step-by-step instructions on installing, configuring, and running the React-based “Hierarchical Graphic Chart” using GitHub Enterprise workflows.
	•	Detail how this submodule integrates with the main project by referencing relevant IaC (Terraform, ARM templates), security policies, branch protection rules, and compliance documents.
	•	Include notes on GitHub Enterprise-specific tasks such as repository permission settings, SAML configurations, and any necessary GitHub API integrations.
	2.	React Application Code for the “Hierarchical Graphic Chart”
	•	Place the code in a directory named hierarchical-chart/.
	•	Include all necessary dependencies (e.g., framer-motion) and provide instructions for npm or yarn installation.
	•	Ensure the code references a local/shared mock JSON data file and includes comments that explain how to replace it with a real backend (such as integrating with GitHub Enterprise API endpoints or internal data services).
	3.	Additional Documentation
	•	Summarize the recommended hierarchical design for Absolute Realms, detailing structures like Realms, Nexus, Branches, and financial compliance frameworks.
	•	Provide short instructions for setting up GitHub Enterprise Organizations and Repositories, referencing internal documentation such as the GitHubEnterpriseSetup component.
	•	Include guidelines for using Infrastructure as Code to deploy supporting Azure resources, and reference any GitHub Actions workflows or CI/CD pipeline integrations used within the enterprise.
	4.	Overview of Recommended Next Steps and Best Practices
	•	Outline the process for adopting or expanding the submodule, such as adding new nodes, integrating with live APIs, or linking to CI/CD pipelines.
	•	Include links or references to existing runbooks, policy documents, and internal guidelines to assist new developers in integrating the submodule into the larger project.

Output Requirements:
	•	Present a proposed submodule folder structure (e.g., absolute-realms-submodule/README.md, absolute-realms-submodule/hierarchical-chart/, etc.).
	•	Provide all relevant code for the React application in a single, consolidated output with clear packaging and installation instructions.
	•	Summarize integration steps in a final section or bullet list so that new developers know exactly how to incorporate the submodule into the GitHub Enterprise project.

Execution:
	•	The final answer should contain the complete submodule code and documentation as one copy-paste ready output.
	•	Any advanced configuration (such as GitHub REST APIs, CI/CD setup, or additional enterprise integrations) should be included either in the README or as inline comments within the code.