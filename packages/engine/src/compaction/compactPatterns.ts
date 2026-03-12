import fs from 'node:fs';
import path from 'node:path';
import type { VerifyReport } from '../report/types.js';
import { canonicalizePatternId } from './canonicalizePatterns.js';
import { resolvePatternBucket, type PatternBucket } from './patternBuckets.js';

const PATTERNS_ARTIFACT_RELATIVE_PATH = '.playbook/patterns.json' as const;
const PLAN_ARTIFACT_RELATIVE_PATH = '.playbook/plan.json' as const;
const REPO_INDEX_RELATIVE_PATH = '.playbook/repo-index.json' as const;

type PatternObservation = {
  text: string;
  example: string;
};

type PlanArtifact = {
  tasks?: Array<{
    ruleId?: string;
    action?: string;
  }>;
};

type RepositoryIndexArtifact = {
  architecture?: string;
  modules?: Array<{ name: string; dependencies: string[] }>;
};

export type CompactedPattern = {
  id: string;
  bucket: PatternBucket;
  occurrences: number;
  examples: string[];
};

export type PatternCompactionArtifact = {
  schemaVersion: '1.0';
  command: 'pattern-compaction';
  patterns: CompactedPattern[];
};

const tryReadJson = <T>(repoRoot: string, relativePath: string): T | null => {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
};

const extractObservations = (repoRoot: string, verifyReport: VerifyReport): PatternObservation[] => {
  const observations: PatternObservation[] = [];

  for (const failure of verifyReport.failures) {
    observations.push({
      text: `${failure.id} ${failure.message}`,
      example: failure.message
    });
  }

  const planArtifact = tryReadJson<PlanArtifact>(repoRoot, PLAN_ARTIFACT_RELATIVE_PATH);
  for (const task of planArtifact?.tasks ?? []) {
    const summary = `${task.ruleId ?? 'plan-task'} ${task.action ?? ''}`.trim();
    observations.push({ text: summary, example: summary });
  }

  const indexArtifact = tryReadJson<RepositoryIndexArtifact>(repoRoot, REPO_INDEX_RELATIVE_PATH);
  if (indexArtifact?.architecture) {
    observations.push({
      text: `architecture ${indexArtifact.architecture}`,
      example: `repository architecture: ${indexArtifact.architecture}`
    });
  }

  for (const moduleEntry of indexArtifact?.modules ?? []) {
    for (const dependency of moduleEntry.dependencies) {
      observations.push({
        text: `module dependency ${moduleEntry.name} depends on ${dependency}`,
        example: `${moduleEntry.name} -> ${dependency}`
      });
    }
  }

  return observations;
};

export const compactPatterns = (repoRoot: string, verifyReport: VerifyReport): PatternCompactionArtifact => {
  const grouped = new Map<string, { bucket: PatternBucket; examples: string[] }>();

  for (const observation of extractObservations(repoRoot, verifyReport)) {
    const id = canonicalizePatternId(observation.text);
    const bucket = resolvePatternBucket(id);
    const existing = grouped.get(id);

    if (!existing) {
      grouped.set(id, { bucket, examples: [observation.example] });
      continue;
    }

    existing.examples.push(observation.example);
  }

  const patterns: CompactedPattern[] = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, value]) => ({
      id,
      bucket: value.bucket,
      occurrences: value.examples.length,
      examples: [...new Set(value.examples)].sort().slice(0, 5)
    }));

  const artifact: PatternCompactionArtifact = {
    schemaVersion: '1.0',
    command: 'pattern-compaction',
    patterns
  };

  const outputPath = path.join(repoRoot, PATTERNS_ARTIFACT_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  return artifact;
};

export const readCompactedPatterns = (repoRoot: string): PatternCompactionArtifact => {
  const artifact = tryReadJson<PatternCompactionArtifact>(repoRoot, PATTERNS_ARTIFACT_RELATIVE_PATH);
  if (!artifact?.patterns) {
    throw new Error('playbook query patterns: missing artifact at .playbook/patterns.json. Run "playbook verify" first.');
  }

  return artifact;
};
