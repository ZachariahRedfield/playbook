import { toPosixPath } from '../util/paths.js';
import type {
  BuildOrchestratorContractInput,
  LaneContract,
  OrchestratorContract,
  PlannerLaneInput,
  SharedFilePolicy
} from './types.js';

const GOVERNANCE_SHARED_FILES = ['README.md', 'docs/CHANGELOG.md', 'docs/PLAYBOOK_PRODUCT_ROADMAP.md'] as const;

const normalizePaths = (paths: string[] | undefined): string[] =>
  Array.from(new Set((paths ?? []).map((value) => toPosixPath(value.trim())).filter(Boolean))).sort((left, right) => left.localeCompare(right));

const sortLanes = (lanes: PlannerLaneInput[]): PlannerLaneInput[] =>
  [...lanes].sort((left, right) => (left.wave ?? 1) - (right.wave ?? 1) || left.goal.localeCompare(right.goal));

const buildLaneContracts = (lanes: PlannerLaneInput[]): LaneContract[] => {
  const ordered = sortLanes(lanes);
  const goalToLaneId = new Map<string, string>();

  ordered.forEach((lane, index) => {
    goalToLaneId.set(lane.goal, `lane-${index + 1}`);
  });

  return ordered.map((lane, index) => ({
    id: `lane-${index + 1}`,
    wave: lane.wave ?? 1,
    goal: lane.goal,
    dependsOn: normalizePaths(lane.dependsOn)
      .map((goal) => goalToLaneId.get(goal))
      .filter((value): value is string => Boolean(value)),
    allowedPaths: normalizePaths(lane.allowedPaths),
    forbiddenPaths: normalizePaths(lane.forbiddenPaths),
    sharedPaths: normalizePaths(lane.sharedPaths)
  }));
};

const overlapPaths = (lanes: LaneContract[]): string[] => {
  const counts = new Map<string, number>();
  for (const lane of lanes) {
    for (const allowed of lane.allowedPaths) {
      counts.set(allowed, (counts.get(allowed) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([path]) => path)
    .sort((left, right) => left.localeCompare(right));
};

const migrateOverlapsToSharedPaths = (lanes: LaneContract[], overlaps: string[]): LaneContract[] => {
  const overlapSet = new Set(overlaps);

  return lanes.map((lane) => {
    if (!lane.allowedPaths.some((path) => overlapSet.has(path))) {
      return lane;
    }

    const allowedPaths = lane.allowedPaths.filter((path) => !overlapSet.has(path));
    const sharedPaths = normalizePaths([...lane.sharedPaths, ...lane.allowedPaths.filter((path) => overlapSet.has(path))]);

    return { ...lane, allowedPaths, sharedPaths };
  });
};

const buildSharedFilePolicy = (lanes: LaneContract[]): SharedFilePolicy[] => {
  return [...GOVERNANCE_SHARED_FILES].map((filePath) => {
      const owners = lanes
        .filter((lane) => lane.allowedPaths.includes(filePath) || lane.sharedPaths.includes(filePath))
        .map((lane) => lane.id);

      if (owners.length === 1) {
        return {
          path: filePath,
          handling: 'single-owner',
          ownerLaneId: owners[0],
          notes: `${owners[0]} is the single owner for ${filePath}.`
        };
      }

      return {
        path: filePath,
        handling: 'deferred-merge',
        ownerLaneId: null,
        notes:
          owners.length === 0
            ? `No lane currently owns ${filePath}; defer edits until a dedicated merge lane is defined.`
            : `${owners.join(', ')} touch ${filePath}; defer merge and resolve in an integration lane.`
      };
    });
};

export const buildOrchestratorContract = (input: BuildOrchestratorContractInput): OrchestratorContract => {
  if (!input.repoRoot.trim()) {
    throw new Error('repoRoot is required to build an orchestrator contract.');
  }

  const initialLanes = buildLaneContracts(input.lanes);
  const overlaps = overlapPaths(initialLanes);

  let lanes = initialLanes;
  if (overlaps.length > 0) {
    if ((input.overlapStrategy ?? 'fail') === 'fail') {
      throw new Error(`Overlapping allowedPaths detected: ${overlaps.join(', ')}.`);
    }
    lanes = migrateOverlapsToSharedPaths(initialLanes, overlaps);
  }

  return {
    generatedAt: 'deterministic',
    goal: input.goal,
    lanes,
    sharedFilePolicy: buildSharedFilePolicy(lanes)
  };
};
