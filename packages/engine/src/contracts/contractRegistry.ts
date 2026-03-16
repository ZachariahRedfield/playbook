import fs from 'node:fs';
import path from 'node:path';

type AvailabilityReason = 'missing' | 'not_applicable' | 'parse_error' | 'not_initialized';

type AvailabilityState =
  | { available: true }
  | {
      available: false;
      reason: AvailabilityReason;
    };

type CliSchemasRegistry = {
  draft: '2020-12';
  schemaCommand: 'playbook schema --json';
  commands: string[];
};

type RuntimeDefaultArtifact = {
  path: string;
  producer: string;
};

type ContractArtifact = {
  path: string;
  availability: AvailabilityState;
};

type RoadmapFeatureStatus = {
  featureId: string;
  status: string;
};

type RoadmapRegistry = {
  path: 'docs/roadmap/ROADMAP.json';
  availability: AvailabilityState;
  schemaVersion: string | null;
  trackedFeatures: RoadmapFeatureStatus[];
};

export type ContractRegistryPayload = {
  schemaVersion: '1.0';
  command: 'contracts';
  cliSchemas: CliSchemasRegistry;
  artifacts: {
    runtimeDefaults: RuntimeDefaultArtifact[];
    contracts: ContractArtifact[];
  };
  roadmap: RoadmapRegistry;
};

type RoadmapFeatureRecord = {
  feature_id?: unknown;
  status?: unknown;
};

type RoadmapFileRecord = {
  schemaVersion?: unknown;
  features?: unknown;
};

const ROADMAP_RELATIVE_PATH = 'docs/roadmap/ROADMAP.json' as const;

const cliSchemaCommands = [
  'ai-context',
  'ai-contract',
  'analyze-pr',
  'knowledge',
  'context',
  'contracts',
  'docs',
  'doctor',
  'explain',
  'graph',
  'index',
  'plan',
  'query',
  'rules',
  'verify'
] as const;

const runtimeDefaults: RuntimeDefaultArtifact[] = [
  { path: '.playbook/ai-contract.json', producer: 'ai-contract' },
  { path: '.playbook/contracts-registry.json', producer: 'contracts' },
  { path: '.playbook/cycle-state.json', producer: 'cycle' },
  { path: '.playbook/repo-graph.json', producer: 'index' },
  { path: '.playbook/repo-index.json', producer: 'index' }
];

const contractArtifacts = ['docs/contracts/ARTIFACT_EVOLUTION_POLICY.md', 'docs/contracts/COMMAND_CONTRACTS_V1.md'] as const;
const trackedRoadmapFeatures = ['PB-V04-ANALYZEPR-001', 'PB-V04-PLAN-APPLY-001', 'PB-V1-DELIVERY-SYSTEM-001'] as const;

const isRoadmapFeatureRecord = (value: unknown): value is RoadmapFeatureRecord => typeof value === 'object' && value !== null;

const getAvailabilityForPath = (absolutePath: string): AvailabilityState =>
  fs.existsSync(absolutePath) ? { available: true } : { available: false, reason: 'missing' };

const buildRoadmapRegistry = (cwd: string): RoadmapRegistry => {
  const roadmapPath = path.join(cwd, ROADMAP_RELATIVE_PATH);
  const availability = getAvailabilityForPath(roadmapPath);

  if (!availability.available) {
    return {
      path: ROADMAP_RELATIVE_PATH,
      availability,
      schemaVersion: null,
      trackedFeatures: []
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(roadmapPath, 'utf8')) as RoadmapFileRecord;
    const featureList = Array.isArray(parsed.features) ? parsed.features : [];

    const trackedFeatures = featureList
      .filter(isRoadmapFeatureRecord)
      .map((feature) => {
        const rawFeatureId = typeof feature.feature_id === 'string' ? feature.feature_id : null;
        const rawStatus = typeof feature.status === 'string' ? feature.status : null;
        if (!rawFeatureId || !rawStatus) {
          return null;
        }

        if (!trackedRoadmapFeatures.includes(rawFeatureId as (typeof trackedRoadmapFeatures)[number])) {
          return null;
        }

        return {
          featureId: rawFeatureId,
          status: rawStatus
        };
      })
      .filter((entry): entry is RoadmapFeatureStatus => entry !== null)
      .sort((left, right) => left.featureId.localeCompare(right.featureId));

    return {
      path: ROADMAP_RELATIVE_PATH,
      availability: { available: true },
      schemaVersion: typeof parsed.schemaVersion === 'string' ? parsed.schemaVersion : null,
      trackedFeatures
    };
  } catch {
    return {
      path: ROADMAP_RELATIVE_PATH,
      availability: { available: false, reason: 'parse_error' },
      schemaVersion: null,
      trackedFeatures: []
    };
  }
};

export const buildContractRegistry = (cwd: string): ContractRegistryPayload => ({
  schemaVersion: '1.0',
  command: 'contracts',
  cliSchemas: {
    draft: '2020-12',
    schemaCommand: 'playbook schema --json',
    commands: [...cliSchemaCommands]
  },
  artifacts: {
    runtimeDefaults: [...runtimeDefaults],
    contracts: [...contractArtifacts].sort((left, right) => left.localeCompare(right)).map((contractPath) => ({
      path: contractPath,
      availability: getAvailabilityForPath(path.join(cwd, contractPath))
    }))
  },
  roadmap: buildRoadmapRegistry(cwd)
});
