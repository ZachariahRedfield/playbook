import { buildLanePromptFilename } from '../execution/lanePrompts.js';
import type { BuildOrchestratorContractInput, OrchestratorContract, OrchestratorLane } from './types.js';

const SHARED_PATHS = ['README.md', 'docs/CHANGELOG.md', 'docs/PLAYBOOK_PRODUCT_ROADMAP.md'] as const;

const normalizeGoal = (goal: string): string => goal.replace(/\s+/g, ' ').trim();

const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));

type LaneBlueprint = Omit<OrchestratorLane, 'id' | 'promptFile' | 'dependsOn'> & { dependsOnLaneIndexes: number[] };

const buildLaneBlueprints = (goal: string): LaneBlueprint[] => [
  {
    title: 'CLI command surface',
    objective: `Implement deterministic CLI orchestration entrypoint for: ${goal}`,
    whyThisLaneExists: 'Owns command flag handling and output routing without launching workers or mutating git state.',
    allowedPaths: ['packages/cli/**'],
    forbiddenPaths: ['packages/engine/**', 'docs/**'],
    sharedPaths: [...SHARED_PATHS],
    wave: 1,
    dependsOnLaneIndexes: [],
    verification: ['pnpm -r build', 'pnpm test -- --run orchestrate'],
    documentationUpdates: ['docs/commands/orchestrate.md', 'docs/commands/README.md'],
    implementationPlan: [
      'Validate required --goal input and lane count bounds.',
      'Wire deterministic orchestrator contract compilation and artifact writing.',
      'Keep command behavior control-plane only (no worker launch, branching, or PR automation).'
    ],
    mergeNotes: ['If shared docs need changes, defer edits to docs/integration lane.']
  },
  {
    title: 'Engine orchestration compiler',
    objective: `Compile ${goal} into deterministic lane contracts with explicit ownership boundaries.`,
    whyThisLaneExists: 'Owns deterministic orchestration domain logic and overlap-free lane contracts.',
    allowedPaths: ['packages/engine/src/orchestrator/**'],
    forbiddenPaths: ['packages/cli/**', 'docs/**'],
    sharedPaths: [...SHARED_PATHS],
    wave: 1,
    dependsOnLaneIndexes: [],
    verification: ['pnpm -r build', 'pnpm test -- --run orchestrator'],
    documentationUpdates: ['docs/commands/orchestrate.md'],
    implementationPlan: [
      'Normalize goal text deterministically.',
      'Generate fixed lane categories and merge deterministically based on requested lane count.',
      'Enforce non-overlapping primary ownership and explicit shared-file surfacing.'
    ],
    mergeNotes: ['Any shared-path edits should be coordinated in a dedicated integration lane.']
  },
  {
    title: 'Tests and deterministic validation',
    objective: 'Add focused tests for artifact validity, deterministic output, shared-path surfacing, and overlap safety.',
    whyThisLaneExists: 'Ensures deterministic contracts remain stable and merge-safe under repeated runs.',
    allowedPaths: ['packages/cli/src/commands/orchestrate.test.ts', 'packages/engine/test/orchestrator.compiler.test.ts'],
    forbiddenPaths: ['packages/engine/src/**', 'docs/**'],
    sharedPaths: [...SHARED_PATHS],
    wave: 1,
    dependsOnLaneIndexes: [],
    verification: ['pnpm test'],
    documentationUpdates: ['docs/CHANGELOG.md'],
    implementationPlan: [
      'Cover success and failure command paths.',
      'Validate wave/dependency ordering and path ownership exclusivity.',
      'Assert stable output for repeated runs with identical input.'
    ],
    mergeNotes: ['If tests imply docs adjustments, route through docs lane instead of direct shared-file edits.']
  },
  {
    title: 'Docs + command-truth integration',
    objective: 'Align orchestrate command docs with governance-first control-plane behavior and worker boundaries.',
    whyThisLaneExists: 'Maintains canonical command-truth and explains non-goals around autonomous execution.',
    allowedPaths: ['docs/commands/orchestrate.md', 'docs/commands/README.md'],
    forbiddenPaths: ['packages/cli/**', 'packages/engine/**'],
    sharedPaths: [...SHARED_PATHS],
    wave: 2,
    dependsOnLaneIndexes: [0, 1, 2],
    verification: ['pnpm docs:update', 'pnpm docs:check', 'pnpm agents:update', 'pnpm agents:check'],
    documentationUpdates: ['README.md', 'docs/CHANGELOG.md', 'docs/PLAYBOOK_PRODUCT_ROADMAP.md'],
    implementationPlan: [
      'Document lane contract schema and shared-file policy behavior.',
      'Update command index and top-level usage references.',
      'Record governance-first orchestration positioning in changelog and roadmap.'
    ],
    mergeNotes: ['This lane may integrate shared docs once implementation lanes are complete.']
  }
];

const mergeBlueprints = (goal: string, laneCount: number): LaneBlueprint[] => {
  const base = buildLaneBlueprints(goal);
  if (laneCount >= 4) {
    return base;
  }

  if (laneCount === 3) {
    const merged = { ...base[2] };
    merged.title = 'Tests + docs integration';
    merged.allowedPaths = uniqueSorted([...base[2].allowedPaths, ...base[3].allowedPaths]);
    merged.forbiddenPaths = uniqueSorted(base[2].forbiddenPaths.filter((path) => !merged.allowedPaths.includes(path)));
    merged.documentationUpdates = uniqueSorted([...base[2].documentationUpdates, ...base[3].documentationUpdates]);
    merged.verification = uniqueSorted([...base[2].verification, ...base[3].verification]);
    merged.dependsOnLaneIndexes = [0, 1];
    merged.wave = 2;
    return [base[0], base[1], merged];
  }

  if (laneCount === 2) {
    const implementation = { ...base[0] };
    implementation.title = 'CLI + engine implementation';
    implementation.allowedPaths = uniqueSorted([...base[0].allowedPaths, ...base[1].allowedPaths]);
    implementation.forbiddenPaths = uniqueSorted(['README.md', 'docs/**']);
    implementation.documentationUpdates = uniqueSorted([...base[0].documentationUpdates, ...base[1].documentationUpdates]);
    implementation.verification = uniqueSorted([...base[0].verification, ...base[1].verification]);

    const integration = { ...base[2] };
    integration.title = 'Validation + documentation integration';
    integration.allowedPaths = uniqueSorted([...base[2].allowedPaths, ...base[3].allowedPaths]);
    integration.forbiddenPaths = uniqueSorted(['packages/cli/**', 'packages/engine/src/**']);
    integration.documentationUpdates = uniqueSorted([...base[2].documentationUpdates, ...base[3].documentationUpdates]);
    integration.verification = uniqueSorted([...base[2].verification, ...base[3].verification]);
    integration.dependsOnLaneIndexes = [0];
    integration.wave = 2;

    return [implementation, integration];
  }

  return [
    {
      title: 'Single-lane deterministic implementation contract',
      objective: `Implement ${goal} with one merge-safe lane because safe parallel decomposition is not available for the requested lane count.`,
      whyThisLaneExists: 'Ensures governance safety by avoiding ambiguous ownership when only one lane is allowed.',
      allowedPaths: ['packages/cli/**', 'packages/engine/src/orchestrator/**', 'packages/engine/test/orchestrator.compiler.test.ts', 'packages/cli/src/commands/orchestrate.test.ts', 'docs/commands/orchestrate.md', 'docs/commands/README.md'],
      forbiddenPaths: [],
      sharedPaths: [...SHARED_PATHS],
      wave: 1,
      dependsOnLaneIndexes: [],
      verification: ['pnpm -r build', 'pnpm test', 'pnpm docs:update', 'pnpm docs:check', 'pnpm agents:update', 'pnpm agents:check'],
      documentationUpdates: ['README.md', 'docs/CHANGELOG.md', 'docs/PLAYBOOK_PRODUCT_ROADMAP.md'],
      implementationPlan: [
        'Implement command and engine behavior in one bounded lane.',
        'Add deterministic tests for output and ownership policy.',
        'Integrate docs and command-truth surfaces explicitly.'
      ],
      mergeNotes: ['Because this is a single lane, shared files can be edited directly with deterministic updates.']
    }
  ];
};

const assertNoOverlap = (lanes: LaneBlueprint[]): void => {
  const owners = new Map<string, number>();

  lanes.forEach((lane, laneIndex) => {
    lane.allowedPaths.forEach((ownedPath) => {
      if (!owners.has(ownedPath)) {
        owners.set(ownedPath, laneIndex);
        return;
      }

      throw new Error(`Overlapping primary ownership detected for ${ownedPath}.`);
    });
  });
};

export const buildOrchestratorContract = (input: BuildOrchestratorContractInput): OrchestratorContract => {
  const goal = normalizeGoal(input.goal);
  if (!goal) {
    throw new Error('goal is required to build an orchestrator contract.');
  }

  const requested = Number.isInteger(input.laneCountRequested) && input.laneCountRequested > 0 ? input.laneCountRequested : 1;
  const warnings: string[] = [];
  if (requested > 4) {
    warnings.push(`Requested ${requested} lanes; reduced to 4 because v1 supports up to four deterministic ownership buckets.`);
  }

  const effectiveLaneCount = Math.min(requested, 4);
  const blueprints = mergeBlueprints(goal, effectiveLaneCount);
  assertNoOverlap(blueprints);

  const lanes: OrchestratorLane[] = blueprints.map((lane, index) => ({
    id: `lane-${index + 1}`,
    title: lane.title,
    objective: lane.objective,
    whyThisLaneExists: lane.whyThisLaneExists,
    allowedPaths: uniqueSorted(lane.allowedPaths),
    forbiddenPaths: uniqueSorted(lane.forbiddenPaths),
    sharedPaths: uniqueSorted(lane.sharedPaths),
    wave: lane.wave,
    dependsOn: uniqueSorted(lane.dependsOnLaneIndexes.map((value) => `lane-${value + 1}`)),
    promptFile: buildLanePromptFilename(index + 1),
    verification: lane.verification,
    documentationUpdates: lane.documentationUpdates,
    implementationPlan: lane.implementationPlan,
    mergeNotes: lane.mergeNotes
  }));

  return {
    schemaVersion: '1.0',
    command: 'orchestrate',
    goal,
    laneCountRequested: requested,
    laneCountProduced: lanes.length,
    sharedPaths: uniqueSorted([...SHARED_PATHS]),
    warnings,
    lanes
  };
};
