import fs from 'node:fs';
import path from 'node:path';

export type OrchestratorLane = {
  id: string;
  allowedPaths: string[];
  sharedPaths?: string[];
  wave?: number;
  dependsOn?: string[];
};

export type OrchestratorContract = {
  schemaVersion: '1.0';
  goal: string;
  lanes: OrchestratorLane[];
  sharedPaths?: string[];
};

export type RepoShape = {
  modules: Array<{ name: string; path: string }>;
};

export type OrchestratorPlanLane = {
  id: string;
  wave: number;
  dependsOn: string[];
  allowedPaths: string[];
  sharedPaths: string[];
};

export type OrchestratorPlan = {
  schemaVersion: '1.0';
  goal: string;
  lanes: OrchestratorPlanLane[];
  repoModules: string[];
};

const sortStable = (values: string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

export const parseOrchestratorContract = (raw: string | OrchestratorContract): OrchestratorContract => {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) as Partial<OrchestratorContract> : raw;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('orchestrator: contract must be an object');
  }

  if (parsed.schemaVersion !== '1.0') {
    throw new Error('orchestrator: unsupported schemaVersion');
  }

  if (!parsed.goal || typeof parsed.goal !== 'string') {
    throw new Error('orchestrator: goal is required');
  }

  if (!Array.isArray(parsed.lanes) || parsed.lanes.length === 0) {
    throw new Error('orchestrator: lanes are required');
  }

  return {
    schemaVersion: '1.0',
    goal: parsed.goal,
    sharedPaths: sortStable(Array.isArray(parsed.sharedPaths) ? parsed.sharedPaths.map(String) : []),
    lanes: parsed.lanes.map((lane) => {
      if (!lane?.id) {
        throw new Error('orchestrator: each lane requires id');
      }

      return {
        id: String(lane.id),
        allowedPaths: sortStable((lane.allowedPaths ?? []).map(String)),
        sharedPaths: sortStable((lane.sharedPaths ?? []).map(String)),
        wave: typeof lane.wave === 'number' ? lane.wave : 1,
        dependsOn: sortStable((lane.dependsOn ?? []).map(String))
      };
    }).sort((a, b) => a.id.localeCompare(b.id))
  };
};

const assertOverlapPolicy = (contract: OrchestratorContract): void => {
  const globalShared = new Set(contract.sharedPaths ?? []);
  const owners = new Map<string, string[]>();
  for (const lane of contract.lanes) {
    for (const allowedPath of lane.allowedPaths) {
      owners.set(allowedPath, [...(owners.get(allowedPath) ?? []), lane.id]);
    }
  }

  for (const [targetPath, laneIds] of owners.entries()) {
    if (laneIds.length < 2) {
      continue;
    }

    if (!globalShared.has(targetPath)) {
      throw new Error(`orchestrator: overlapping allowedPaths require shared policy: ${targetPath}`);
    }

    for (const laneId of laneIds) {
      const lane = contract.lanes.find((entry) => entry.id === laneId);
      if (!lane || !(lane.sharedPaths ?? []).includes(targetPath)) {
        throw new Error(`orchestrator: shared path must be explicit on lane ${laneId}: ${targetPath}`);
      }
    }
  }
};

const assertDependencyWaves = (contract: OrchestratorContract): void => {
  const byId = new Map(contract.lanes.map((lane) => [lane.id, lane]));
  for (const lane of contract.lanes) {
    for (const dependency of lane.dependsOn ?? []) {
      const dependentLane = byId.get(dependency);
      if (!dependentLane) {
        throw new Error(`orchestrator: lane ${lane.id} dependsOn unknown lane ${dependency}`);
      }

      if ((dependentLane.wave ?? 1) >= (lane.wave ?? 1)) {
        throw new Error(`orchestrator: lane ${lane.id} must have wave greater than dependsOn lane ${dependency}`);
      }
    }
  }
};

export const buildOrchestratorPlan = (contractInput: string | OrchestratorContract, repoShape: RepoShape): OrchestratorPlan => {
  const contract = parseOrchestratorContract(contractInput);
  assertOverlapPolicy(contract);
  assertDependencyWaves(contract);

  return {
    schemaVersion: '1.0',
    goal: contract.goal,
    lanes: [...contract.lanes]
      .sort((left, right) => (left.wave ?? 1) - (right.wave ?? 1) || left.id.localeCompare(right.id))
      .map((lane) => ({
        id: lane.id,
        wave: lane.wave ?? 1,
        dependsOn: sortStable(lane.dependsOn ?? []),
        allowedPaths: sortStable(lane.allowedPaths),
        sharedPaths: sortStable(lane.sharedPaths ?? [])
      })),
    repoModules: sortStable(repoShape.modules.map((module) => `${module.name}:${module.path}`))
  };
};

export const writeOrchestratorArtifacts = (outDir: string, plan: OrchestratorPlan): { planPath: string; lanesPath: string } => {
  fs.mkdirSync(outDir, { recursive: true });
  const planPath = path.join(outDir, 'orchestrator.plan.json');
  const lanesPath = path.join(outDir, 'orchestrator.lanes.json');
  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  fs.writeFileSync(lanesPath, `${JSON.stringify({ lanes: plan.lanes }, null, 2)}\n`, 'utf8');
  return { planPath, lanesPath };
};
