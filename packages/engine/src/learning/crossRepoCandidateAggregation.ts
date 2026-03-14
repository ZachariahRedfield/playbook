import fs from 'node:fs';
import path from 'node:path';

export type CrossRepoCandidateInput = {
  id: string;
  repoPath: string;
};

type PatternCandidateRecord = {
  id: string;
  pattern_family: string;
  confidence: number;
};

type PatternCandidatesArtifact = {
  kind: 'pattern-candidates';
  generatedAt: string;
  candidates: PatternCandidateRecord[];
};

export type CrossRepoCandidateFamilyAggregate = {
  pattern_family: string;
  repo_count: number;
  candidate_count: number;
  mean_confidence: number;
  repos: string[];
  first_seen: string;
  last_seen: string;
};

export type CrossRepoCandidatesArtifact = {
  schemaVersion: '1.0';
  kind: 'cross-repo-candidates';
  generatedAt: string;
  repositories: string[];
  families: CrossRepoCandidateFamilyAggregate[];
};

const CROSS_REPO_CANDIDATES_RELATIVE_PATH = '.playbook/cross-repo-candidates.json' as const;
const PATTERN_CANDIDATES_RELATIVE_PATH = '.playbook/pattern-candidates.json' as const;
const DEFAULT_GENERATED_AT = '1970-01-01T00:00:00.000Z';

const readJson = <T>(targetPath: string): T => JSON.parse(fs.readFileSync(targetPath, 'utf8')) as T;

const clampConfidence = (value: number): number => Math.max(0, Math.min(1, Number(value.toFixed(4))));

const normalizePatternFamily = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-');

const readPatternCandidatesArtifact = (repoPath: string): PatternCandidatesArtifact => {
  const artifactPath = path.join(repoPath, PATTERN_CANDIDATES_RELATIVE_PATH);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`playbook cross-repo candidates: missing artifact at ${artifactPath}`);
  }

  const artifact = readJson<PatternCandidatesArtifact>(artifactPath);
  if (artifact.kind !== 'pattern-candidates') {
    throw new Error(`playbook cross-repo candidates: invalid artifact kind at ${artifactPath}. Expected "pattern-candidates".`);
  }

  return artifact;
};

export const computeCrossRepoCandidateAggregation = (repositories: CrossRepoCandidateInput[]): CrossRepoCandidatesArtifact => {
  const aggregateByFamily = new Map<
    string,
    {
      repos: Set<string>;
      candidateCount: number;
      confidenceSum: number;
      firstSeen: string;
      lastSeen: string;
    }
  >();

  const repositoryIds = [...new Set(repositories.map((entry) => entry.id))].sort((left, right) => left.localeCompare(right));
  let generatedAt = DEFAULT_GENERATED_AT;

  for (const repository of repositories) {
    const artifact = readPatternCandidatesArtifact(repository.repoPath);
    if (artifact.generatedAt > generatedAt) {
      generatedAt = artifact.generatedAt;
    }

    for (const candidate of artifact.candidates) {
      const patternFamily = normalizePatternFamily(candidate.pattern_family);
      const aggregate =
        aggregateByFamily.get(patternFamily) ??
        {
          repos: new Set<string>(),
          candidateCount: 0,
          confidenceSum: 0,
          firstSeen: artifact.generatedAt,
          lastSeen: artifact.generatedAt
        };

      aggregate.repos.add(repository.id);
      aggregate.candidateCount += 1;
      aggregate.confidenceSum += clampConfidence(candidate.confidence);
      if (artifact.generatedAt < aggregate.firstSeen) {
        aggregate.firstSeen = artifact.generatedAt;
      }
      if (artifact.generatedAt > aggregate.lastSeen) {
        aggregate.lastSeen = artifact.generatedAt;
      }

      aggregateByFamily.set(patternFamily, aggregate);
    }
  }

  const families: CrossRepoCandidateFamilyAggregate[] = [...aggregateByFamily.entries()]
    .map(([patternFamily, aggregate]) => ({
      pattern_family: patternFamily,
      repo_count: aggregate.repos.size,
      candidate_count: aggregate.candidateCount,
      mean_confidence: clampConfidence(aggregate.confidenceSum / aggregate.candidateCount),
      repos: [...aggregate.repos].sort((left, right) => left.localeCompare(right)),
      first_seen: aggregate.firstSeen,
      last_seen: aggregate.lastSeen
    }))
    .sort((left, right) => left.pattern_family.localeCompare(right.pattern_family));

  return {
    schemaVersion: '1.0',
    kind: 'cross-repo-candidates',
    generatedAt,
    repositories: repositoryIds,
    families
  };
};

export const writeCrossRepoCandidatesArtifact = (cwd: string, artifact: CrossRepoCandidatesArtifact): string => {
  const targetPath = path.join(cwd, CROSS_REPO_CANDIDATES_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return targetPath;
};

export const readCrossRepoCandidatesArtifact = (cwd: string): CrossRepoCandidatesArtifact => {
  const targetPath = path.join(cwd, CROSS_REPO_CANDIDATES_RELATIVE_PATH);
  if (!fs.existsSync(targetPath)) {
    throw new Error('playbook cross-repo candidates: missing artifact at .playbook/cross-repo-candidates.json.');
  }
  return readJson<CrossRepoCandidatesArtifact>(targetPath);
};
