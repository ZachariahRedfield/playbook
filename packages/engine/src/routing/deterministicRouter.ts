import type { ExecutionSurface, ExecutionTaskFamily, TaskExecutionProfileProposal } from './executionRouter.js';

export type SupportedTaskFamily = ExecutionTaskFamily;

export type ResolvedTaskRoute = {
  taskFamily: SupportedTaskFamily | 'unknown';
  affectedSurfaces: ExecutionSurface[];
  estimatedChangeSurface: 'small' | 'medium' | 'large';
  profile?: TaskExecutionProfileProposal;
  warnings: string[];
  missingPrerequisites: string[];
  supported: boolean;
};

const sortUnique = <T extends string>(values: readonly T[]): T[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const FAMILY_PRIORITY: SupportedTaskFamily[] = ['docs_only', 'contracts_schema', 'cli_command', 'engine_scoring', 'pattern_learning'];

const PROFILE_CATALOG: Record<SupportedTaskFamily, TaskExecutionProfileProposal> = {
  docs_only: {
    task_family: 'docs_only',
    scope: 'single-module',
    affected_surfaces: ['docs', 'governance'],
    rule_packs: ['docs-governance'],
    required_validations: ['pnpm playbook docs audit --json'],
    optional_validations: ['pnpm -r build'],
    docs_requirements: ['docs/commands/README.md', 'docs/CHANGELOG.md'],
    parallel_safe: true,
    estimated_change_surface: 'small'
  },
  contracts_schema: {
    task_family: 'contracts_schema',
    scope: 'single-module',
    affected_surfaces: ['contracts', 'governance', 'schemas'],
    rule_packs: ['contract-registry', 'schema-governance'],
    required_validations: ['pnpm -r build', 'pnpm playbook schema verify --json'],
    optional_validations: ['pnpm playbook verify --ci --json'],
    docs_requirements: ['docs/contracts/TASK_EXECUTION_PROFILE.md', 'docs/CHANGELOG.md'],
    parallel_safe: false,
    estimated_change_surface: 'medium'
  },
  cli_command: {
    task_family: 'cli_command',
    scope: 'single-module',
    affected_surfaces: ['cli', 'docs', 'governance', 'tests'],
    rule_packs: ['command-surface-governance', 'docs-governance'],
    required_validations: ['pnpm -r build', 'pnpm agents:check', 'pnpm agents:update'],
    optional_validations: ['pnpm playbook docs audit --json'],
    docs_requirements: ['README.md', 'docs/commands/README.md', 'docs/CHANGELOG.md'],
    parallel_safe: false,
    estimated_change_surface: 'medium'
  },
  engine_scoring: {
    task_family: 'engine_scoring',
    scope: 'single-module',
    affected_surfaces: ['engine', 'governance', 'tests'],
    rule_packs: ['engine-runtime', 'scoring-safety'],
    required_validations: ['pnpm --filter @zachariahredfield/playbook-engine test', 'pnpm -r build'],
    optional_validations: ['pnpm playbook verify --ci --json'],
    docs_requirements: ['docs/CHANGELOG.md'],
    parallel_safe: false,
    estimated_change_surface: 'medium'
  },
  pattern_learning: {
    task_family: 'pattern_learning',
    scope: 'single-module',
    affected_surfaces: ['engine', 'governance', 'knowledge', 'tests'],
    rule_packs: ['knowledge-integrity', 'pattern-governance'],
    required_validations: ['pnpm --filter @zachariahredfield/playbook-engine test', 'pnpm -r build'],
    optional_validations: ['pnpm playbook patterns list --json'],
    docs_requirements: ['docs/CHANGELOG.md'],
    parallel_safe: false,
    estimated_change_surface: 'large'
  }
};

const FAMILY_MATCHERS: Record<SupportedTaskFamily, RegExp[]> = {
  docs_only: [/\b(doc|docs|documentation|readme|changelog|command docs)\b/],
  contracts_schema: [/\b(contract|contracts|schema|schemas|json schema|registry)\b/],
  cli_command: [/\b(cli|command|commands|flag|subcommand|route command)\b/],
  engine_scoring: [/\b(score|scoring|rank|fitness|attractor|engine scoring)\b/],
  pattern_learning: [/\b(pattern learning|learn|learning|pattern|knowledge|memory|cross-repo)\b/]
};

export const resolveDeterministicTaskRoute = (task: string): ResolvedTaskRoute => {
  const normalized = task.toLowerCase();
  const matchedFamilies = FAMILY_PRIORITY.filter((family) => FAMILY_MATCHERS[family].some((matcher) => matcher.test(normalized)));

  if (matchedFamilies.length === 0) {
    return {
      taskFamily: 'unknown',
      affectedSurfaces: [],
      estimatedChangeSurface: 'small',
      warnings: [],
      missingPrerequisites: [
        'task must specify one supported family: docs_only, contracts_schema, cli_command, engine_scoring, pattern_learning'
      ],
      supported: false
    };
  }

  const selectedFamily = matchedFamilies[0];
  const profile = PROFILE_CATALOG[selectedFamily];

  if (!profile) {
    return {
      taskFamily: selectedFamily,
      affectedSurfaces: [],
      estimatedChangeSurface: 'small',
      warnings: [],
      missingPrerequisites: [`missing task-execution-profile for family: ${selectedFamily}`],
      supported: false
    };
  }

  const warnings: string[] = [];
  if (matchedFamilies.length > 1) {
    warnings.push(
      `ambiguous task family signals detected (${matchedFamilies.join(', ')}); conservatively selected ${selectedFamily}.`
    );
  }

  return {
    taskFamily: selectedFamily,
    affectedSurfaces: sortUnique(profile.affected_surfaces),
    estimatedChangeSurface: profile.estimated_change_surface,
    profile,
    warnings,
    missingPrerequisites: [],
    supported: true
  };
};
