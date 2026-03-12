import fs from 'node:fs';
import path from 'node:path';
import type { RepositoryIndex, RepositoryModule } from '../indexer/repoIndexer.js';
import { resolveRepositoryTarget, type ResolvedTarget } from '../intelligence/targetResolver.js';
import { readJsonArtifact, INVALID_ARTIFACT_ERROR } from '../artifacts/artifactIO.js';

export type RiskLevel = 'low' | 'medium' | 'high';

export type RiskSignals = {
  directDependencies: number;
  dependents: number;
  transitiveImpact: number;
  verifyFailures: number;
  isArchitecturalHub: boolean;
};

export type RiskContributions = {
  fanIn: number;
  impact: number;
  verifyFailures: number;
  hub: number;
};

export type RiskQueryResult = {
  schemaVersion: '1.0';
  command: 'query';
  type: 'risk';
  module: string;
  resolvedTarget: ResolvedTarget;
  riskScore: number;
  riskLevel: RiskLevel;
  signals: RiskSignals;
  contributions: RiskContributions;
  reasons: string[];
  warnings?: string[];
};

type VerifyFailure = {
  id?: string;
  message?: string;
  evidence?: string;
  fix?: string;
};

const INDEX_RELATIVE_PATH = '.playbook/repo-index.json' as const;
const VERIFY_ARTIFACT_RELATIVE_PATHS = ['.playbook/verify-report.json', '.playbook/verify.json', '.playbook/findings.json', '.playbook/plan.json'] as const;

const SCORE_WEIGHTS = {
  fanIn: 0.35,
  impact: 0.35,
  verifyFailures: 0.2,
  hub: 0.1
} as const;

const HUB_DEPENDENTS_THRESHOLD = 3;

const invalidArtifactRecoveryHint =
  'Regenerate artifacts with CLI-owned output flags (for example: "playbook verify --json --out .playbook/findings.json" and "playbook plan --json --out .playbook/plan.json").';

const parseRequiredJsonArtifact = (absolutePath: string, consumer: string): Record<string, unknown> => {
  try {
    return readJsonArtifact<Record<string, unknown>>(absolutePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(INVALID_ARTIFACT_ERROR)) {
      throw new Error(`${consumer}: invalid or corrupted JSON artifact at ${absolutePath}. ${invalidArtifactRecoveryHint}`);
    }
    throw new Error(`${consumer}: unable to read JSON artifact at ${absolutePath}: ${message}`);
  }
};

const parseOptionalJsonArtifact = (
  absolutePath: string,
  consumer: string
): { payload: Record<string, unknown> | null; warning?: string } => {
  try {
    return { payload: parseRequiredJsonArtifact(absolutePath, consumer) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      payload: null,
      warning: `${consumer}: optional artifact at ${absolutePath} is unreadable or corrupted; risk verification signals were skipped. ${message}`
    };
  }
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const roundRiskScore = (value: number): number => Math.round(value * 100) / 100;

const readRepositoryIndex = (projectRoot: string): RepositoryIndex => {
  const indexPath = path.join(projectRoot, INDEX_RELATIVE_PATH);
  if (!fs.existsSync(indexPath)) {
    throw new Error('playbook query: missing repository index at .playbook/repo-index.json. Run "playbook index" first.');
  }

  const parsed = parseRequiredJsonArtifact(indexPath, 'playbook query') as Partial<RepositoryIndex>;

  if (parsed.schemaVersion !== '1.0') {
    throw new Error(
      `playbook query: unsupported repository index schemaVersion "${String(parsed.schemaVersion)}". Expected "1.0".`
    );
  }

  return parsed as RepositoryIndex;
};

const buildReverseGraph = (modules: RepositoryModule[]): Map<string, string[]> => {
  const reverseGraph = new Map<string, string[]>();

  for (const moduleEntry of modules) {
    reverseGraph.set(moduleEntry.name, []);
  }

  for (const moduleEntry of modules) {
    for (const dependency of moduleEntry.dependencies) {
      const dependents = reverseGraph.get(dependency) ?? [];
      dependents.push(moduleEntry.name);
      reverseGraph.set(dependency, dependents);
    }
  }

  return reverseGraph;
};

const computeTransitiveImpact = (moduleName: string, reverseGraph: Map<string, string[]>): number => {
  const visited = new Set<string>();
  const queue = [...(reverseGraph.get(moduleName) ?? [])];

  for (const dependent of queue) {
    visited.add(dependent);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    for (const dependent of reverseGraph.get(current) ?? []) {
      if (!visited.has(dependent)) {
        visited.add(dependent);
        queue.push(dependent);
      }
    }
  }

  return visited.size;
};

const readVerifyFailures = (projectRoot: string): { failures: VerifyFailure[]; warning?: string } => {
  const warnings: string[] = [];

  for (const relativePath of VERIFY_ARTIFACT_RELATIVE_PATHS) {
    const absolutePath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const parsedArtifact = parseOptionalJsonArtifact(absolutePath, 'playbook query risk');
    if (parsedArtifact.warning) {
      warnings.push(parsedArtifact.warning);
      continue;
    }

    const payload = parsedArtifact.payload;
    if (!payload) {
      continue;
    }

    const findings = Array.isArray(payload.failures)
      ? (payload.failures as VerifyFailure[])
      : Array.isArray(payload.findings)
        ? (payload.findings as VerifyFailure[])
        : [];

    return {
      failures: findings,
      warning: warnings.length > 0 ? warnings.join(' ') : undefined
    };
  }

  if (warnings.length > 0) {
    return {
      failures: [],
      warning: warnings.join(' ')
    };
  }

  return {
    failures: [],
    warning:
      'Verify failure signal unavailable; no .playbook/verify-report.json, .playbook/verify.json, .playbook/findings.json, or .playbook/plan.json verify payload found.'
  };
};

const countModuleVerifyFailures = (moduleName: string, failures: VerifyFailure[]): number => {
  const moduleToken = moduleName.toLowerCase();

  return failures.filter((failure) => {
    const blob = [failure.id, failure.message, failure.evidence, failure.fix]
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .toLowerCase();

    return blob.includes(moduleToken);
  }).length;
};

export const queryRisk = (projectRoot: string, moduleName: string): RiskQueryResult => {
  const index = readRepositoryIndex(projectRoot);
  const resolvedTarget = resolveRepositoryTarget(projectRoot, moduleName);
  if (resolvedTarget.kind !== 'module') {
    throw new Error(`playbook query risk: unknown module "${moduleName}".`);
  }

  const targetModule = index.modules.find((moduleEntry) => moduleEntry.name === resolvedTarget.selector);

  if (!targetModule) {
    throw new Error(`playbook query risk: unknown module "${moduleName}".`);
  }

  const reverseGraph = buildReverseGraph(index.modules);
  const dependents = (reverseGraph.get(resolvedTarget.selector) ?? []).length;
  const transitiveImpact = computeTransitiveImpact(resolvedTarget.selector, reverseGraph);
  const isArchitecturalHub = dependents >= HUB_DEPENDENTS_THRESHOLD;
  const verifySignal = readVerifyFailures(projectRoot);
  const verifyFailures = countModuleVerifyFailures(resolvedTarget.selector, verifySignal.failures);

  const fanInScore = clamp(dependents / Math.max(index.modules.length - 1, 1), 0, 1);
  const impactScore = clamp(transitiveImpact / Math.max(index.modules.length - 1, 1), 0, 1);
  const verifyScore = clamp(verifyFailures / 3, 0, 1);

  const contributions: RiskContributions = {
    fanIn: roundRiskScore(fanInScore * SCORE_WEIGHTS.fanIn),
    impact: roundRiskScore(impactScore * SCORE_WEIGHTS.impact),
    verifyFailures: roundRiskScore(verifyScore * SCORE_WEIGHTS.verifyFailures),
    hub: isArchitecturalHub ? SCORE_WEIGHTS.hub : 0
  };

  const riskScore = roundRiskScore(contributions.fanIn + contributions.impact + contributions.verifyFailures + contributions.hub);

  const riskLevel: RiskLevel = riskScore >= 0.7 ? 'high' : riskScore >= 0.4 ? 'medium' : 'low';

  const reasons: string[] = [];
  if (dependents >= Math.max(2, Math.ceil((index.modules.length - 1) * 0.5))) {
    reasons.push('High reverse dependency fan-in');
  }

  if (transitiveImpact >= Math.max(2, Math.ceil((index.modules.length - 1) * 0.5))) {
    reasons.push('Large transitive impact radius');
  }

  if (isArchitecturalHub) {
    reasons.push('Module acts as an architectural hub');
  }

  if (verifyFailures > 0) {
    reasons.push('Active verify failures associated with this module');
  }

  if (reasons.length === 0) {
    reasons.push('Low fan-in and limited transitive impact');
  }

  const result: RiskQueryResult = {
    schemaVersion: '1.0',
    command: 'query',
    type: 'risk',
    module: resolvedTarget.selector,
    resolvedTarget,
    riskScore,
    riskLevel,
    signals: {
      directDependencies: targetModule.dependencies.length,
      dependents,
      transitiveImpact,
      verifyFailures,
      isArchitecturalHub
    },
    contributions,
    reasons
  };

  if (verifySignal.warning) {
    result.warnings = [verifySignal.warning];
  }

  return result;
};
