import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { computeCrossRepoPatternLearning, type CrossRepoInput, type CrossRepoPatternsArtifact } from '../scoring/crossRepoPatternLearning.js';

export type CrossRepoCandidateInput = CrossRepoInput;

export type CrossRepoPatternCandidate = {
  id: string;
  title: string;
  when: string;
  then: string;
  because: string;
  normalizationKey: string;
  sourceRefs: string[];
  storySeed: {
    title: string;
    rationale: string;
    acceptanceCriteria: string[];
  };
  fingerprint: string;
};

export type CrossRepoCandidatesArtifact = {
  schemaVersion: '1.0';
  kind: 'cross-repo-candidates';
  generatedAt: string;
  repositories: string[];
  candidates: CrossRepoPatternCandidate[];
};

const CROSS_REPO_CANDIDATES_RELATIVE_PATH = '.playbook/cross-repo-candidates.json' as const;
const DEFAULT_GENERATED_AT = '1970-01-01T00:00:00.000Z';

const readJson = <T>(targetPath: string): T => JSON.parse(fs.readFileSync(targetPath, 'utf8')) as T;
const hashText = (value: string): string => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort((left, right) => left.localeCompare(right));
const slugify = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'candidate';
const normalizeToken = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

const toSourceRef = (entry: {
  repo_id: string;
  artifact_kind: string;
  artifact_path: string;
  pointer: string;
  value_digest: string | null;
}): string => [entry.repo_id, entry.artifact_kind, entry.artifact_path, entry.pointer, entry.value_digest ?? 'no-digest'].join('::');

const candidateGeneratedAt = (artifact: CrossRepoPatternsArtifact): string => artifact.generatedAt ?? artifact.generated_at ?? DEFAULT_GENERATED_AT;
const candidateRepositories = (artifact: CrossRepoPatternsArtifact): string[] => uniqueSorted(
  (artifact.source_repos ?? []).map((entry) => entry.repo_id).concat((artifact.repositories ?? []).map((entry) => entry.id))
);

const buildNormalizationKey = (candidate: CrossRepoPatternsArtifact['candidate_patterns'][number], sourceRefs: string[]): string => {
  const repoIds = uniqueSorted(candidate.evidence.map((entry) => entry.repo_id));
  const artifactKinds = uniqueSorted(candidate.evidence.map((entry) => entry.artifact_kind));
  return [
    normalizeToken(candidate.classification),
    normalizeToken(candidate.id),
    normalizeToken(candidate.title),
    normalizeToken(repoIds.join('-')),
    normalizeToken(artifactKinds.join('-')),
    normalizeToken(String(sourceRefs.length))
  ].filter((entry) => entry.length > 0).join('::');
};

const toCandidateRecord = (candidate: CrossRepoPatternsArtifact['candidate_patterns'][number]): CrossRepoPatternCandidate | null => {
  if (candidate.classification === 'gap') return null;
  const repoIds = uniqueSorted(candidate.evidence.map((entry) => entry.repo_id));
  if (repoIds.length < 2) return null;

  const sourceRefs = uniqueSorted(candidate.evidence.map(toSourceRef));
  const normalizationKey = buildNormalizationKey(candidate, sourceRefs);
  const sourceRefHash = hashText(sourceRefs.join('\n'));
  const id = `candidate.${slugify(normalizationKey)}.${sourceRefHash.slice(0, 12)}`;
  const because = `Cross-repo evidence shows ${candidate.title.toLowerCase()} across ${repoIds.length} repositories using only governed references.`;
  const when = `When ${repoIds.join(', ')} all emit governed evidence for ${candidate.title.toLowerCase()}.`;
  const then = `Then review ${candidate.title} as a portable cross-repo pattern candidate without copying source artifact bodies.`;

  return {
    id,
    title: candidate.title,
    when,
    then,
    because,
    normalizationKey,
    sourceRefs,
    storySeed: {
      title: `Review portable pattern: ${candidate.title}`,
      rationale: because,
      acceptanceCriteria: [
        `Verify governed evidence for ${candidate.title} across ${repoIds.length} repositories.`,
        'Decide whether the normalized candidate should advance through explicit promotion.',
        'Keep promotion evidence limited to source references rather than copied artifact bodies.'
      ]
    },
    fingerprint: hashText(JSON.stringify({ normalizationKey, sourceRefs }))
  };
};

export const computeCrossRepoCandidateAggregation = (repositories: CrossRepoCandidateInput[]): CrossRepoCandidatesArtifact => {
  const patternLearningArtifact = computeCrossRepoPatternLearning(repositories);
  const candidates = (patternLearningArtifact.candidate_patterns ?? [])
    .map(toCandidateRecord)
    .filter((entry): entry is CrossRepoPatternCandidate => entry !== null)
    .sort((left, right) => left.normalizationKey.localeCompare(right.normalizationKey) || left.id.localeCompare(right.id));

  return {
    schemaVersion: '1.0',
    kind: 'cross-repo-candidates',
    generatedAt: candidateGeneratedAt(patternLearningArtifact),
    repositories: candidateRepositories(patternLearningArtifact),
    candidates
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
