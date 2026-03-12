import { buildLanePromptFilename } from '../execution/lanePrompts.js';
import type { BuildOrchestratorContractInput, OrchestratorContract, OrchestratorLaneContract } from './types.js';

const SHARED_PATHS = ['README.md', 'docs/CHANGELOG.md', 'docs/PLAYBOOK_PRODUCT_ROADMAP.md'] as const;

const normalizeGoal = (goal: string): string => goal.replace(/\s+/g, ' ').trim();

const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));

const SHARED_PATH_POLICY_ORDER = new Map<string, number>(SHARED_PATHS.map((sharedPath, index) => [sharedPath, index]));

const orderSharedPaths = (values: string[]): string[] => {
  const unique = Array.from(new Set(values));

  return unique.sort((left, right) => {
    const leftPolicyIndex = SHARED_PATH_POLICY_ORDER.get(left);
    const rightPolicyIndex = SHARED_PATH_POLICY_ORDER.get(right);

    if (leftPolicyIndex !== undefined && rightPolicyIndex !== undefined) {
      return leftPolicyIndex - rightPolicyIndex;
    }

    if (leftPolicyIndex !== undefined) {
      return -1;
    }

    if (rightPolicyIndex !== undefined) {
      return 1;
    }

    return left.localeCompare(right);
  });
};

type LaneBlueprint = Omit<OrchestratorLaneContract, 'id' | 'promptFile' | 'dependsOn' | 'shardKey'> & { dependsOnLaneIndexes: number[] };

const SHARD_KEY_PREFIX_RULES: Array<{ prefix: string; shardKey: string }> = [
  { prefix: 'packages/engine/', shardKey: 'packages-engine' },
  { prefix: 'packages/cli/', shardKey: 'packages-cli' },
  { prefix: 'packages/core/', shardKey: 'packages-core' },
  { prefix: 'docs/', shardKey: 'docs' },
  { prefix: 'tests/', shardKey: 'tests' }
];

const SHARED_GOVERNANCE_PATHS = new Set<string>([
  ...SHARED_PATHS,
  'docs/commands/orchestrate.md',
  'docs/commands/README.md',
  'README.md'
]);

const toShardSegment = (value: string): string =>
  value
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\./g, '-')
    .replace(/[^a-zA-Z0-9/-]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();

const shardKeyFromPath = (ownedPath: string): string => {
  const normalized = toShardSegment(ownedPath);
  for (const rule of SHARD_KEY_PREFIX_RULES) {
    if (normalized.startsWith(rule.prefix)) {
      return rule.shardKey;
    }
  }

  if (normalized.startsWith('docs/')) {
    return 'docs';
  }

  if (normalized.startsWith('tests/')) {
    return 'tests';
  }

  const segments = normalized.split('/').filter(Boolean);
  if (segments.length >= 2) {
    return `${segments[0]}-${segments[1]}`;
  }

  if (segments.length === 1) {
    return segments[0];
  }

  return 'shared-governance';
};


const isTestOwnedPath = (ownedPath: string): boolean => {
  const normalized = toShardSegment(ownedPath);
  return normalized.startsWith('tests/') || normalized.includes('/test/') || normalized.includes('.test-') || normalized.endsWith('-test-ts');
};

const deriveShardKey = (allowedPaths: string[]): string => {
  if (allowedPaths.length === 0) {
    return 'shared-governance';
  }

  const sortedPaths = uniqueSorted(allowedPaths);
  const exclusivePaths = sortedPaths.filter((ownedPath) => !SHARED_GOVERNANCE_PATHS.has(ownedPath));

  if (exclusivePaths.length === 0) {
    return 'shared-governance';
  }

  if (exclusivePaths.every((ownedPath) => isTestOwnedPath(ownedPath))) {
    return 'tests';
  }

  return shardKeyFromPath(exclusivePaths[0]);
};

const isSharedGovernanceShard = (shardKey: string): boolean => shardKey === 'shared-governance';

const assertShardOwnershipByWave = (lanes: OrchestratorLaneContract[]): void => {
  const perWave = new Map<number, Map<string, string>>();

  lanes.forEach((lane) => {
    const waveShards = perWave.get(lane.wave) ?? new Map<string, string>();
    const existingOwner = waveShards.get(lane.shardKey);

    if (existingOwner) {
      throw new Error(`Duplicate shardKey in wave ${lane.wave}: ${lane.shardKey} owned by ${existingOwner} and ${lane.id}.`);
    }

    waveShards.set(lane.shardKey, lane.id);
    perWave.set(lane.wave, waveShards);
  });

  lanes.forEach((lane) => {
    if (!isSharedGovernanceShard(lane.shardKey)) {
      return;
    }

    const hasOnlySharedPaths = lane.allowedPaths.every((ownedPath) => SHARED_GOVERNANCE_PATHS.has(ownedPath));
    if (!hasOnlySharedPaths) {
      throw new Error(`Lane ${lane.id} mixes shared-governance shard with exclusive ownership paths.`);
    }
  });
};

const buildLaneBlueprints = (goal: string): LaneBlueprint[] => [
  {
    title: 'CLI command wrapper integration',
    objective: `Route orchestrate command inputs/outputs through deterministic engine compilation for: ${goal}`,
    allowedPaths: ['packages/cli/**'],
    forbiddenPaths: ['packages/engine/**', 'docs/**'],
    sharedPaths: [...SHARED_PATHS],
    wave: 1,
    dependsOnLaneIndexes: [],
    verification: ['pnpm -r build', 'pnpm test -- --run orchestrate'],
    documentationUpdates: ['docs/commands/orchestrate.md', 'docs/commands/README.md']
  },
  {
    title: 'Engine lane-contract compiler',
    objective: `Compile lane contracts with explicit ownership metadata for: ${goal}`,
    allowedPaths: ['packages/engine/src/orchestrator/**'],
    forbiddenPaths: ['packages/cli/**', 'docs/**'],
    sharedPaths: [...SHARED_PATHS],
    wave: 1,
    dependsOnLaneIndexes: [],
    verification: ['pnpm -r build', 'pnpm test -- --run orchestrator'],
    documentationUpdates: ['docs/commands/orchestrate.md']
  },
  {
    title: 'Deterministic contract validation',
    objective: 'Validate stable lane contracts, dependency waves, and ownership boundaries.',
    allowedPaths: ['packages/cli/src/commands/orchestrate.test.ts', 'packages/engine/test/orchestrator.compiler.test.ts'],
    forbiddenPaths: ['packages/engine/src/**', 'docs/**'],
    sharedPaths: [...SHARED_PATHS],
    wave: 1,
    dependsOnLaneIndexes: [],
    verification: ['pnpm test'],
    documentationUpdates: ['docs/CHANGELOG.md']
  },
  {
    title: 'Documentation alignment',
    objective: 'Update command and governance docs to match lane-contract orchestration behavior.',
    allowedPaths: ['docs/commands/orchestrate.md', 'docs/commands/README.md'],
    forbiddenPaths: ['packages/cli/**', 'packages/engine/**'],
    sharedPaths: [...SHARED_PATHS],
    wave: 2,
    dependsOnLaneIndexes: [0, 1, 2],
    verification: ['pnpm docs:update', 'pnpm docs:check', 'pnpm agents:update', 'pnpm agents:check'],
    documentationUpdates: ['README.md', 'docs/CHANGELOG.md', 'docs/PLAYBOOK_PRODUCT_ROADMAP.md']
  }
];

const mergeBlueprints = (goal: string, laneCount: number): LaneBlueprint[] => {
  const base = buildLaneBlueprints(goal);
  if (laneCount >= 4) {
    return base;
  }

  if (laneCount === 3) {
    const merged = { ...base[2] };
    merged.title = 'Validation + documentation integration';
    merged.allowedPaths = uniqueSorted([...base[2].allowedPaths, ...base[3].allowedPaths]);
    merged.forbiddenPaths = uniqueSorted(base[2].forbiddenPaths.filter((targetPath) => !merged.allowedPaths.includes(targetPath)));
    merged.documentationUpdates = uniqueSorted([...base[2].documentationUpdates, ...base[3].documentationUpdates]);
    merged.verification = uniqueSorted([...base[2].verification, ...base[3].verification]);
    merged.dependsOnLaneIndexes = [0, 1];
    merged.wave = 2;
    return [base[0], base[1], merged];
  }

  if (laneCount === 2) {
    const implementation = { ...base[0] };
    implementation.title = 'CLI + engine compiler implementation';
    implementation.allowedPaths = uniqueSorted([...base[0].allowedPaths, ...base[1].allowedPaths]);
    implementation.forbiddenPaths = uniqueSorted(['README.md', 'docs/**']);
    implementation.documentationUpdates = uniqueSorted([...base[0].documentationUpdates, ...base[1].documentationUpdates]);
    implementation.verification = uniqueSorted([...base[0].verification, ...base[1].verification]);

    const integration = { ...base[2] };
    integration.title = 'Validation + docs integration';
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
      title: 'Single-lane implementation contract',
      objective: `Implement ${goal} in one bounded lane because the requested lane count cannot be safely decomposed.`,
      allowedPaths: ['packages/cli/**', 'packages/engine/src/orchestrator/**', 'packages/engine/test/orchestrator.compiler.test.ts', 'packages/cli/src/commands/orchestrate.test.ts', 'docs/commands/orchestrate.md', 'docs/commands/README.md'],
      forbiddenPaths: [],
      sharedPaths: [...SHARED_PATHS],
      wave: 1,
      dependsOnLaneIndexes: [],
      verification: ['pnpm -r build', 'pnpm test', 'pnpm docs:update', 'pnpm docs:check', 'pnpm agents:update', 'pnpm agents:check'],
      documentationUpdates: ['README.md', 'docs/CHANGELOG.md', 'docs/PLAYBOOK_PRODUCT_ROADMAP.md']
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

  const lanes: OrchestratorLaneContract[] = blueprints.map((lane, index) => ({
    shardKey: deriveShardKey(lane.allowedPaths),
    id: `lane-${index + 1}`,
    title: lane.title,
    objective: lane.objective,
    allowedPaths: uniqueSorted(lane.allowedPaths),
    forbiddenPaths: uniqueSorted(lane.forbiddenPaths),
    sharedPaths: orderSharedPaths(lane.sharedPaths),
    wave: lane.wave,
    dependsOn: uniqueSorted(lane.dependsOnLaneIndexes.map((value) => `lane-${value + 1}`)),
    promptFile: buildLanePromptFilename(index + 1),
    verification: uniqueSorted(lane.verification),
    documentationUpdates: uniqueSorted(lane.documentationUpdates)
  }));

  assertShardOwnershipByWave(lanes);

  return {
    schemaVersion: '1.0',
    command: 'orchestrate',
    goal,
    laneCountRequested: requested,
    laneCountProduced: lanes.length,
    sharedPaths: orderSharedPaths([...SHARED_PATHS]),
    warnings,
    lanes
  };
};
