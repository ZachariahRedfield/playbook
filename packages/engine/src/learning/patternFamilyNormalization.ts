import fs from 'node:fs';
import path from 'node:path';

export type PatternFamilyDiscoveryInput = {
  id: string;
  repoPath: string;
};

type PatternCandidateRecord = {
  id: string;
  pattern_family: string;
  title: string;
  confidence: number;
};

type PatternCandidatesArtifact = {
  kind: 'pattern-candidates';
  generatedAt: string;
  candidates: PatternCandidateRecord[];
};

export type PatternFamilyDiscoveryFamily = {
  pattern_family: string;
  repo_count: number;
  candidate_count: number;
  mean_confidence: number;
  candidate_ids: string[];
};

export type PatternFamilyAssignment = {
  candidate_id: string;
  repo_id: string;
  source_pattern_family: string;
  pattern_family: string;
};

export type PatternFamilyDiscoveryArtifact = {
  schemaVersion: '1.0';
  kind: 'pattern-family-discovery';
  generatedAt: string;
  repositories: string[];
  families: PatternFamilyDiscoveryFamily[];
  assignments: PatternFamilyAssignment[];
};

export const PATTERN_FAMILY_DISCOVERY_RELATIVE_PATH = '.playbook/pattern-family-discovery.json' as const;
const PATTERN_CANDIDATES_RELATIVE_PATH = '.playbook/pattern-candidates.json' as const;
const DEFAULT_GENERATED_AT = '1970-01-01T00:00:00.000Z';

const readJson = <T>(targetPath: string): T => JSON.parse(fs.readFileSync(targetPath, 'utf8')) as T;
const round4 = (value: number): number => Number(value.toFixed(4));
const clampConfidence = (value: number): number => Math.max(0, Math.min(1, round4(value)));

const normalizeText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toSlug = (value: string): string =>
  normalizeText(value)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const removeSimplePlural = (token: string): string => {
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('s') && token.length > 3) return token.slice(0, -1);
  return token;
};

const tokenize = (value: string): string[] =>
  normalizeText(value)
    .split(' ')
    .map(removeSimplePlural)
    .filter((token) => token.length > 1 && !['the', 'and', 'for', 'with', 'from', 'into', 'across'].includes(token));

const TITLE_NORMALIZATION_MAP: Array<{ matcher: RegExp; patternFamily: string }> = [
  { matcher: /\blayer(ed|ing)?\b|dependency ordering/, patternFamily: 'layering' },
  { matcher: /\bbounded\b.*\bmodule\b.*\binterface\b|\bmodular(ity)?\b/, patternFamily: 'modularity' },
  { matcher: /\bcyclic\b.*\bworkflow\b|\brecurs(ion|ive)?\b/, patternFamily: 'recursion' },
  { matcher: /\bschema\b.*\benvelope\b.*\bsymmetr(y|ic)\b|\bsymmetr(y|ic)\b/, patternFamily: 'symmetry' },
  { matcher: /query before mutation|query-before-mutation/, patternFamily: 'query-before-mutation' }
];

const resolveCanonicalFamily = (patternFamily: string, title: string): string => {
  const combined = `${patternFamily} ${title}`.toLowerCase();
  for (const entry of TITLE_NORMALIZATION_MAP) {
    if (entry.matcher.test(combined)) {
      return entry.patternFamily;
    }
  }

  const slug = toSlug(patternFamily);
  if (slug.endsWith('-pattern')) {
    return slug.replace(/-pattern$/, '');
  }

  return slug;
};

const jaccard = (left: string[], right: string[]): number => {
  if (left.length === 0 || right.length === 0) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
};

const shouldMergeFamilies = (left: string, right: string): boolean => {
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  const score = jaccard(tokenize(left), tokenize(right));
  return score >= 0.75;
};

const readPatternCandidatesArtifact = (repoPath: string): PatternCandidatesArtifact => {
  const artifactPath = path.join(repoPath, PATTERN_CANDIDATES_RELATIVE_PATH);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`playbook pattern family discovery: missing artifact at ${artifactPath}`);
  }

  const artifact = readJson<PatternCandidatesArtifact>(artifactPath);
  if (artifact.kind !== 'pattern-candidates') {
    throw new Error(`playbook pattern family discovery: invalid artifact kind at ${artifactPath}. Expected "pattern-candidates".`);
  }

  return artifact;
};

const buildFamilyMergeMap = (families: string[]): Map<string, string> => {
  const ordered = [...new Set(families)].sort((left, right) => left.localeCompare(right));
  const parent = new Map(ordered.map((family) => [family, family]));

  const find = (value: string): string => {
    const next = parent.get(value) ?? value;
    if (next === value) return value;
    const root = find(next);
    parent.set(value, root);
    return root;
  };

  const union = (left: string, right: string): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    const canonical = [leftRoot, rightRoot].sort((a, b) => a.localeCompare(b))[0] as string;
    const merged = canonical === leftRoot ? rightRoot : leftRoot;
    parent.set(merged, canonical);
  };

  for (let index = 0; index < ordered.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < ordered.length; nextIndex += 1) {
      const left = ordered[index] as string;
      const right = ordered[nextIndex] as string;
      if (shouldMergeFamilies(left, right)) {
        union(left, right);
      }
    }
  }

  const map = new Map<string, string>();
  for (const family of ordered) {
    map.set(family, find(family));
  }
  return map;
};

export const buildPatternFamilyDiscoveryArtifact = (repositories: PatternFamilyDiscoveryInput[]): PatternFamilyDiscoveryArtifact => {
  const assignments: PatternFamilyAssignment[] = [];
  let generatedAt = DEFAULT_GENERATED_AT;

  for (const repository of repositories) {
    const artifact = readPatternCandidatesArtifact(repository.repoPath);
    if (artifact.generatedAt > generatedAt) {
      generatedAt = artifact.generatedAt;
    }

    for (const candidate of artifact.candidates) {
      assignments.push({
        candidate_id: candidate.id,
        repo_id: repository.id,
        source_pattern_family: candidate.pattern_family,
        pattern_family: resolveCanonicalFamily(candidate.pattern_family, candidate.title)
      });
    }
  }

  const mergeMap = buildFamilyMergeMap(assignments.map((assignment) => assignment.pattern_family));
  for (const assignment of assignments) {
    assignment.pattern_family = mergeMap.get(assignment.pattern_family) ?? assignment.pattern_family;
  }

  const confidenceLookup = new Map<string, number>();
  for (const repository of repositories) {
    const artifact = readPatternCandidatesArtifact(repository.repoPath);
    for (const candidate of artifact.candidates) {
      confidenceLookup.set(`${repository.id}:${candidate.id}`, clampConfidence(candidate.confidence));
    }
  }

  const grouped = new Map<
    string,
    {
      repos: Set<string>;
      candidateIds: string[];
      confidenceTotal: number;
      count: number;
    }
  >();

  for (const assignment of assignments) {
    const key = assignment.pattern_family;
    const entry =
      grouped.get(key) ?? {
        repos: new Set<string>(),
        candidateIds: [],
        confidenceTotal: 0,
        count: 0
      };

    entry.repos.add(assignment.repo_id);
    entry.candidateIds.push(assignment.candidate_id);
    entry.confidenceTotal += confidenceLookup.get(`${assignment.repo_id}:${assignment.candidate_id}`) ?? 0;
    entry.count += 1;
    grouped.set(key, entry);
  }

  const families: PatternFamilyDiscoveryFamily[] = [...grouped.entries()]
    .map(([patternFamily, aggregate]) => ({
      pattern_family: patternFamily,
      repo_count: aggregate.repos.size,
      candidate_count: aggregate.count,
      mean_confidence: aggregate.count === 0 ? 0 : round4(aggregate.confidenceTotal / aggregate.count),
      candidate_ids: [...aggregate.candidateIds].sort((left, right) => left.localeCompare(right))
    }))
    .sort((left, right) => left.pattern_family.localeCompare(right.pattern_family));

  return {
    schemaVersion: '1.0',
    kind: 'pattern-family-discovery',
    generatedAt,
    repositories: [...new Set(repositories.map((repository) => repository.id))].sort((left, right) => left.localeCompare(right)),
    families,
    assignments: assignments.sort(
      (left, right) =>
        left.pattern_family.localeCompare(right.pattern_family) ||
        left.repo_id.localeCompare(right.repo_id) ||
        left.candidate_id.localeCompare(right.candidate_id)
    )
  };
};

export const writePatternFamilyDiscoveryArtifact = (cwd: string, artifact: PatternFamilyDiscoveryArtifact): string => {
  const targetPath = path.join(cwd, PATTERN_FAMILY_DISCOVERY_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return targetPath;
};

export const readPatternFamilyDiscoveryArtifact = (cwd: string): PatternFamilyDiscoveryArtifact => {
  const targetPath = path.join(cwd, PATTERN_FAMILY_DISCOVERY_RELATIVE_PATH);
  if (!fs.existsSync(targetPath)) {
    throw new Error('playbook pattern family discovery: missing artifact at .playbook/pattern-family-discovery.json.');
  }
  return readJson<PatternFamilyDiscoveryArtifact>(targetPath);
};
