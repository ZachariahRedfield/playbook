export type CommandCategory = 'Core' | 'Repository tools' | 'Repository intelligence' | 'Utility';

export type CommandMetadata = {
  name: string;
  description: string;
  category: CommandCategory;
  productFacing: boolean;
  example: string;
  machineReadable: boolean;
};

export const commandMetadata: CommandMetadata[] = [
  {
    name: 'analyze',
    description: 'Analyze project stack',
    category: 'Core',
    productFacing: true,
    example: 'playbook analyze --json',
    machineReadable: true
  },
  {
    name: 'verify',
    description: 'Verify governance rules',
    category: 'Core',
    productFacing: true,
    example: 'playbook verify --ci --json',
    machineReadable: true
  },
  {
    name: 'plan',
    description: 'Generate a structured fix plan from rule findings',
    category: 'Core',
    productFacing: true,
    example: 'playbook plan --json',
    machineReadable: true
  },
  {
    name: 'apply',
    description: 'Execute deterministic auto-fixable plan tasks',
    category: 'Core',
    productFacing: true,
    example: 'playbook apply --from-plan .playbook/plan.json',
    machineReadable: true
  },
  {
    name: 'analyze-pr',
    description: 'Analyze local branch/worktree changes with deterministic PR intelligence',
    category: 'Repository tools',
    productFacing: true,
    example: 'playbook analyze-pr --json',
    machineReadable: true
  },
  {
    name: 'doctor',
    description: 'Diagnose repository health by aggregating verify, risk, docs, and index analyzers',
    category: 'Repository tools',
    productFacing: true,
    example: 'playbook doctor --fix --dry-run',
    machineReadable: true
  },
  {
    name: 'diagram',
    description: 'Generate deterministic architecture Mermaid diagrams',
    category: 'Repository tools',
    productFacing: true,
    example: 'playbook diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md',
    machineReadable: false
  },
  {
    name: 'docs',
    description: 'Audit documentation governance surfaces and contracts',
    category: 'Repository tools',
    productFacing: true,
    example: 'playbook docs audit --json',
    machineReadable: true
  },
  {
    name: 'rules',
    description: 'List loaded verify and analyze rules',
    category: 'Repository tools',
    productFacing: true,
    example: 'playbook rules --json',
    machineReadable: true
  },
  {
    name: 'schema',
    description: 'Print JSON Schemas for Playbook CLI command outputs',
    category: 'Repository tools',
    productFacing: true,
    example: 'playbook schema verify --json',
    machineReadable: true
  },
  {
    name: 'context',
    description: 'Print deterministic CLI and architecture context for tools and agents',
    category: 'Repository tools',
    productFacing: true,
    example: 'playbook context --json',
    machineReadable: true
  },

  {
    name: 'ai-context',
    description: 'Print deterministic AI bootstrap context for Playbook-aware agents',
    category: 'Repository tools',
    productFacing: true,
    example: 'playbook ai-context --json',
    machineReadable: true
  },
  {
    name: 'ai-contract',
    description: 'Print deterministic AI repository contract for Playbook-aware agents',
    category: 'Repository tools',
    productFacing: true,
    example: 'playbook ai-contract --json',
    machineReadable: true
  },
  {
    name: 'index',
    description: 'Generate machine-readable repository intelligence index',
    category: 'Repository intelligence',
    productFacing: true,
    example: 'playbook index --json',
    machineReadable: true
  },
  {
    name: 'graph',
    description: 'Summarize machine-readable repository knowledge graph from .playbook/repo-graph.json',
    category: 'Repository intelligence',
    productFacing: true,
    example: 'playbook graph --json',
    machineReadable: true
  },
  {
    name: 'query',
    description: 'Query machine-readable repository intelligence from .playbook/repo-index.json',
    category: 'Repository intelligence',
    productFacing: true,
    example: 'playbook query modules --json',
    machineReadable: true
  },
  {
    name: 'deps',
    description: 'Print module dependency graph from .playbook/repo-index.json',
    category: 'Repository intelligence',
    productFacing: true,
    example: 'playbook deps workouts --json',
    machineReadable: true
  },
  {
    name: 'ask',
    description: 'Answer repository questions from machine-readable intelligence context',
    category: 'Repository intelligence',
    productFacing: true,
    example: 'playbook ask "where should a new feature live?" --repo-context --json',
    machineReadable: true
  },
  {
    name: 'explain',
    description: 'Explain rules, modules, or architecture from repository intelligence',
    category: 'Repository intelligence',
    productFacing: true,
    example: 'playbook explain architecture --json',
    machineReadable: true
  },
  {
    name: 'demo',
    description: 'Show the official Playbook demo repository and guided first-run workflow',
    category: 'Utility',
    productFacing: false,
    example: 'playbook demo',
    machineReadable: false
  },
  {
    name: 'init',
    description: 'Initialize playbook docs/config',
    category: 'Utility',
    productFacing: false,
    example: 'playbook init',
    machineReadable: true
  },
  {
    name: 'fix',
    description: 'Apply safe, deterministic autofixes for verify findings',
    category: 'Utility',
    productFacing: false,
    example: 'playbook fix --dry-run',
    machineReadable: true
  },
  {
    name: 'status',
    description: 'Show overall Playbook repository health',
    category: 'Utility',
    productFacing: false,
    example: 'playbook status --json',
    machineReadable: true
  },
  {
    name: 'upgrade',
    description: 'Plan safe upgrades and local deterministic migrations',
    category: 'Utility',
    productFacing: false,
    example: 'playbook upgrade --check --json',
    machineReadable: true
  },
  {
    name: 'session',
    description: 'Import, merge, and cleanup session snapshots',
    category: 'Utility',
    productFacing: false,
    example: 'playbook session --help',
    machineReadable: true
  }
];

export const getCommandMetadata = (name: string): CommandMetadata | undefined =>
  commandMetadata.find((command) => command.name === name);
