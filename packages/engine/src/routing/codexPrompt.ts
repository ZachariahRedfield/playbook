import type { ExecutionPlanArtifact } from './executionPlan.js';
import type { RouteDecision } from './types.js';

const sortUnique = (values: readonly string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const DOC_UPDATES_BY_FAMILY: Record<string, string[]> = {
  docs_only: ['docs/commands/README.md', 'docs/CHANGELOG.md'],
  contracts_schema: ['docs/contracts/TASK_EXECUTION_PROFILE.md', 'docs/CHANGELOG.md'],
  cli_command: ['README.md', 'docs/commands/README.md', 'docs/CHANGELOG.md'],
  engine_scoring: ['docs/CHANGELOG.md'],
  pattern_learning: ['docs/CHANGELOG.md']
};

const IMPLEMENTATION_STEPS_BY_FAMILY: Record<string, string[]> = {
  docs_only: [
    'Inspect current docs command surfaces and identify minimal, bounded edits.',
    'Apply deterministic documentation updates only within expected surfaces.',
    'Validate docs governance and preserve proposal-only execution boundaries.'
  ],
  contracts_schema: [
    'Extend contract/schema fields additively and preserve backward compatibility.',
    'Update routing and consumer surfaces to consume new fields deterministically.',
    'Add contract fixtures/tests and confirm no baseline governance drift.'
  ],
  cli_command: [
    'Additive CLI flag/behavior implementation with deterministic argument parsing.',
    'Integrate prompt compilation output without launching workers or creating branches/PRs.',
    'Update CLI tests and command documentation for the new route behavior.'
  ],
  engine_scoring: [
    'Apply bounded engine updates to preserve deterministic scoring and ordering.',
    'Keep conservative fallback behavior and proposal-only posture intact.',
    'Add focused tests for scoring-related route-to-prompt generation behavior.'
  ],
  pattern_learning: [
    'Add bounded pattern-learning route refinements without expanding autonomous behavior.',
    'Preserve deterministic ordering and conservative governance defaults.',
    'Add targeted tests for learn/prompt interoperability and proposal-only compliance.'
  ],
  unknown: [
    'Resolve missing prerequisites before implementation proceeds.',
    'Re-run routing after prerequisite resolution to obtain a bounded deterministic plan.'
  ]
};

const GOVERNANCE_BLOCK = [
  'Rule — Router v1 should stay explicit and bounded before becoming broad and adaptive.',
  'Pattern — Deterministic task-family routing becomes much more valuable when it compiles directly into worker-ready execution prompts.',
  'Failure Mode — Expanding route families faster than route semantics will create a wide router that feels smart but produces weak plans.'
];

export const compileCodexPrompt = (task: string, decision: RouteDecision, executionPlan: ExecutionPlanArtifact): string => {
  const filesAndSurfaces = sortUnique([...executionPlan.expected_surfaces, ...executionPlan.likely_conflict_surfaces]);
  const docsUpdates = sortUnique(DOC_UPDATES_BY_FAMILY[executionPlan.task_family] ?? ['docs/CHANGELOG.md']);
  const implementationPlan = IMPLEMENTATION_STEPS_BY_FAMILY[executionPlan.task_family] ?? IMPLEMENTATION_STEPS_BY_FAMILY.unknown;
  const verificationSteps = [...executionPlan.required_validations, ...executionPlan.optional_validations];

  const lines: string[] = [];
  lines.push('Objective');
  lines.push('');
  lines.push(task);
  lines.push('');

  lines.push('Implementation plan');
  lines.push('');
  for (const step of implementationPlan) {
    lines.push(`- ${step}`);
  }
  lines.push('');

  lines.push('Files / surfaces to modify');
  lines.push('');
  if (filesAndSurfaces.length === 0) {
    lines.push('- Resolve prerequisites; no implementation surfaces are unlocked yet.');
  } else {
    for (const surface of filesAndSurfaces) {
      lines.push(`- ${surface}`);
    }
  }
  lines.push('');

  lines.push('Verification steps');
  lines.push('');
  if (verificationSteps.length === 0) {
    lines.push('- pnpm playbook route "<task>" --json');
  } else {
    for (const step of verificationSteps) {
      lines.push(`- ${step}`);
    }
  }
  lines.push('');

  lines.push('Documentation updates');
  lines.push('');
  for (const item of docsUpdates) {
    lines.push(`- ${item}`);
  }
  lines.push('');

  lines.push('Rule / Pattern / Failure Mode');
  lines.push('');
  for (const item of GOVERNANCE_BLOCK) {
    lines.push(`- ${item}`);
  }

  if (executionPlan.missing_prerequisites.length > 0 || decision.route === 'unsupported') {
    lines.push('');
    lines.push('Prerequisites (required before implementation)');
    lines.push('');
    for (const prerequisite of executionPlan.missing_prerequisites) {
      lines.push(`- ${prerequisite}`);
    }
  }

  if (executionPlan.warnings.length > 0) {
    lines.push('');
    lines.push('Conservative warnings');
    lines.push('');
    for (const warning of executionPlan.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push('');
  lines.push('Proposal-only boundaries');
  lines.push('');
  lines.push('- No worker launching.');
  lines.push('- No branch creation.');
  lines.push('- No PR creation.');
  lines.push('- No autonomous mutation.');

  return `${lines.join('\n')}\n`;
};
