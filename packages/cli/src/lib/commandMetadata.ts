export type CommandCategory = 'Core' | 'Repository tools' | 'Repository intelligence' | 'Utility';
export type CommandRole = 'bootstrap' | 'repo-intelligence' | 'governance' | 'remediation' | 'compatibility' | 'utility';
export type CommandLifecycle = 'canonical' | 'compatibility' | 'utility' | 'planned-reference';
export type CommandDiscoverability = 'primary' | 'secondary' | 'hidden-compatibility';

export type CommandMetadata = {
  name: string;
  description: string;
  category: CommandCategory;
  role: CommandRole;
  lifecycle: CommandLifecycle;
  discoverability: CommandDiscoverability;
  onboardingPriority: number | null;
  canonicalSequence: number | null;
  productFacing: boolean;
  exampleArgs: string;
  machineReadable: boolean;
};

export const commandMetadata: CommandMetadata[] = [
  {
    name: 'analyze',
    description: 'Analyze project stack',
    category: 'Core',
    role: 'compatibility',
    lifecycle: 'compatibility',
    discoverability: 'hidden-compatibility',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: true,
    exampleArgs: 'analyze --json',
    machineReadable: true
  },
  {
    name: 'pilot',
    description: 'Run deterministic baseline external repository analysis in one command',
    category: 'Core',
    role: 'bootstrap',
    lifecycle: 'canonical',
    discoverability: 'primary',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: true,
    exampleArgs: 'pilot --repo "./target-repo" --json',
    machineReadable: true
  },
  {
    name: 'verify',
    description: 'Verify governance rules',
    category: 'Core',
    role: 'governance',
    lifecycle: 'canonical',
    discoverability: 'primary',
    onboardingPriority: 8,
    canonicalSequence: 8,
    productFacing: true,
    exampleArgs: 'verify --ci --json',
    machineReadable: true
  },
  {
    name: 'plan',
    description: 'Generate a structured fix plan from rule findings',
    category: 'Core',
    role: 'remediation',
    lifecycle: 'canonical',
    discoverability: 'primary',
    onboardingPriority: 9,
    canonicalSequence: 9,
    productFacing: true,
    exampleArgs: 'plan --json',
    machineReadable: true
  },
  {
    name: 'apply',
    description: 'Execute deterministic auto-fixable plan tasks',
    category: 'Core',
    role: 'remediation',
    lifecycle: 'canonical',
    discoverability: 'primary',
    onboardingPriority: 10,
    canonicalSequence: 10,
    productFacing: true,
    exampleArgs: 'apply --from-plan .playbook/plan.json',
    machineReadable: true
  },
  {
    name: 'analyze-pr',
    description: 'Analyze local branch/worktree changes with deterministic PR intelligence',
    category: 'Repository tools',
    role: 'repo-intelligence',
    lifecycle: 'canonical',
    discoverability: 'secondary',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: true,
    exampleArgs: 'analyze-pr --json',
    machineReadable: true
  },
  {
    name: 'doctor',
    description: 'Diagnose repository health by aggregating verify, risk, docs, and index analyzers',
    category: 'Repository tools',
    role: 'governance',
    lifecycle: 'canonical',
    discoverability: 'secondary',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: true,
    exampleArgs: 'doctor --fix --dry-run',
    machineReadable: true
  },
  {
    name: 'diagram',
    description: 'Generate deterministic architecture Mermaid diagrams',
    category: 'Repository tools',
    role: 'utility',
    lifecycle: 'utility',
    discoverability: 'secondary',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: true,
    exampleArgs: 'diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md',
    machineReadable: false
  },
  {
    name: 'docs',
    description: 'Audit documentation governance surfaces and contracts',
    category: 'Repository tools',
    role: 'governance',
    lifecycle: 'canonical',
    discoverability: 'secondary',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: true,
    exampleArgs: 'docs audit --json',
    machineReadable: true
  },
  {
    name: 'audit',
    description: 'Audit deterministic architecture guardrails and platform hardening controls',
    category: 'Repository tools',
    role: 'governance',
    lifecycle: 'canonical',
    discoverability: 'secondary',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: true,
    exampleArgs: 'audit architecture --json',
    machineReadable: true
  },
  {
    name: 'rules',
    description: 'List loaded verify and analyze rules',
    category: 'Repository tools',
    role: 'governance',
    lifecycle: 'canonical',
    discoverability: 'secondary',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: true,
    exampleArgs: 'rules --json',
    machineReadable: true
  },
  {
    name: 'schema',
    description: 'Print JSON Schemas for Playbook CLI command outputs',
    category: 'Repository tools',
    role: 'utility',
    lifecycle: 'utility',
    discoverability: 'secondary',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: true,
    exampleArgs: 'schema verify --json',
    machineReadable: true
  },
  {
    name: 'context',
    description: 'Print deterministic CLI and architecture context for tools and agents',
    category: 'Repository tools',
    role: 'bootstrap',
    lifecycle: 'canonical',
    discoverability: 'primary',
    onboardingPriority: 3,
    canonicalSequence: 3,
    productFacing: true,
    exampleArgs: 'context --json',
    machineReadable: true
  },
  {
    name: 'ai-context',
    description: 'Print deterministic AI bootstrap context for Playbook-aware agents',
    category: 'Repository tools',
    role: 'bootstrap',
    lifecycle: 'canonical',
    discoverability: 'primary',
    onboardingPriority: 1,
    canonicalSequence: 1,
    productFacing: true,
    exampleArgs: 'ai-context --json',
    machineReadable: true
  },
  {
    name: 'ai-contract',
    description: 'Print deterministic AI repository contract for Playbook-aware agents',
    category: 'Repository tools',
    role: 'bootstrap',
    lifecycle: 'canonical',
    discoverability: 'primary',
    onboardingPriority: 2,
    canonicalSequence: 2,
    productFacing: true,
    exampleArgs: 'ai-contract --json',
    machineReadable: true
  },

  {
    name: 'pilot',
    description: 'Run one-command external baseline analysis workflow for a target repository',
    category: 'Repository tools',
    role: 'bootstrap',
    lifecycle: 'canonical',
    discoverability: 'primary',
    onboardingPriority: 11,
    canonicalSequence: 11,
    productFacing: true,
    exampleArgs: 'pilot --repo ../target-repo --json',
    machineReadable: true
  },

  {
    name: 'contracts',
    description: 'Emit deterministic contract registry for schemas, artifacts, and roadmap status',
    category: 'Repository tools',
    role: 'utility',
    lifecycle: 'utility',
    discoverability: 'secondary',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: true,
    exampleArgs: 'contracts --json',
    machineReadable: true
  },
  {
    name: 'index',
    description: 'Generate machine-readable repository intelligence index',
    category: 'Repository intelligence',
    role: 'repo-intelligence',
    lifecycle: 'canonical',
    discoverability: 'primary',
    onboardingPriority: 4,
    canonicalSequence: 4,
    productFacing: true,
    exampleArgs: 'index --json',
    machineReadable: true
  },
  {
    name: 'graph',
    description: 'Summarize machine-readable repository knowledge graph from .playbook/repo-graph.json',
    category: 'Repository intelligence',
    role: 'repo-intelligence',
    lifecycle: 'canonical',
    discoverability: 'secondary',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: true,
    exampleArgs: 'graph --json',
    machineReadable: true
  },
  {
    name: 'query',
    description: 'Query machine-readable repository intelligence from .playbook/repo-index.json',
    category: 'Repository intelligence',
    role: 'repo-intelligence',
    lifecycle: 'canonical',
    discoverability: 'primary',
    onboardingPriority: 5,
    canonicalSequence: 5,
    productFacing: true,
    exampleArgs: 'query modules --json',
    machineReadable: true
  },
  {
    name: 'deps',
    description: 'Print module dependency graph from .playbook/repo-index.json',
    category: 'Repository intelligence',
    role: 'repo-intelligence',
    lifecycle: 'canonical',
    discoverability: 'secondary',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: true,
    exampleArgs: 'deps workouts --json',
    machineReadable: true
  },
  {
    name: 'ask',
    description: 'Answer repository questions from machine-readable intelligence context',
    category: 'Repository intelligence',
    role: 'repo-intelligence',
    lifecycle: 'canonical',
    discoverability: 'primary',
    onboardingPriority: 7,
    canonicalSequence: 7,
    productFacing: true,
    exampleArgs: 'ask "where should a new feature live?" --repo-context --json',
    machineReadable: true
  },
  {
    name: 'explain',
    description: 'Explain rules, modules, or architecture from repository intelligence',
    category: 'Repository intelligence',
    role: 'repo-intelligence',
    lifecycle: 'canonical',
    discoverability: 'primary',
    onboardingPriority: 6,
    canonicalSequence: 6,
    productFacing: true,
    exampleArgs: 'explain architecture --json',
    machineReadable: true
  },
  {
    name: 'demo',
    description: 'Show the official Playbook demo repository and guided first-run workflow',
    category: 'Utility',
    role: 'utility',
    lifecycle: 'utility',
    discoverability: 'secondary',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: false,
    exampleArgs: 'demo',
    machineReadable: false
  },
  {
    name: 'init',
    description: 'Initialize playbook docs/config',
    category: 'Utility',
    role: 'utility',
    lifecycle: 'utility',
    discoverability: 'secondary',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: false,
    exampleArgs: 'init',
    machineReadable: true
  },
  {
    name: 'fix',
    description: 'Apply safe, deterministic autofixes for verify findings',
    category: 'Utility',
    role: 'compatibility',
    lifecycle: 'compatibility',
    discoverability: 'hidden-compatibility',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: false,
    exampleArgs: 'fix --dry-run',
    machineReadable: true
  },
  {
    name: 'status',
    description: 'Show overall Playbook repository health',
    category: 'Utility',
    role: 'utility',
    lifecycle: 'utility',
    discoverability: 'secondary',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: false,
    exampleArgs: 'status --json',
    machineReadable: true
  },
  {
    name: 'upgrade',
    description: 'Plan safe upgrades and local deterministic migrations',
    category: 'Utility',
    role: 'utility',
    lifecycle: 'utility',
    discoverability: 'secondary',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: false,
    exampleArgs: 'upgrade --check --json',
    machineReadable: true
  },
  {
    name: 'session',
    description: 'Import, merge, and cleanup session snapshots',
    category: 'Utility',
    role: 'utility',
    lifecycle: 'utility',
    discoverability: 'secondary',
    onboardingPriority: null,
    canonicalSequence: null,
    productFacing: false,
    exampleArgs: 'session --help',
    machineReadable: true
  }
];

export const getCommandMetadata = (name: string): CommandMetadata | undefined =>
  commandMetadata.find((command) => command.name === name);
