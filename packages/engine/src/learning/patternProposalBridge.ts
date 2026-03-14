import fs from 'node:fs';
import path from 'node:path';
import { type CrossRepoCandidatesArtifact, readCrossRepoCandidatesArtifact } from './crossRepoCandidateAggregation.js';

export const PATTERN_PROPOSALS_RELATIVE_PATH = '.playbook/pattern-proposals.json' as const;
const MIN_REPO_COUNT = 2;
const MIN_PORTABILITY_SCORE = 0.65;

export type PatternProposal = {
  proposal_id: string;
  pattern_family: string;
  candidate_repos: string[];
  mean_confidence: number;
  portability_score: number;
  proposed_action: 'append_instance';
  target_pattern: string;
};

export type PatternProposalArtifact = {
  schemaVersion: '1.0';
  kind: 'pattern-proposals';
  generatedAt: string;
  proposals: PatternProposal[];
};

const readJson = <T>(targetPath: string): T => JSON.parse(fs.readFileSync(targetPath, 'utf8')) as T;
const round4 = (value: number): number => Number(value.toFixed(4));

const computeRepoSignal = (repoCount: number, maxRepoCount: number): number => {
  if (maxRepoCount <= 0) return 0;
  return round4(repoCount / maxRepoCount);
};

const computePortabilityScore = (repoSignal: number, meanConfidence: number): number => round4(0.5 * repoSignal + 0.5 * meanConfidence);

export const buildPatternProposalArtifact = (candidatesArtifact: CrossRepoCandidatesArtifact): PatternProposalArtifact => {
  const maxRepoCount = candidatesArtifact.families.reduce((max, family) => Math.max(max, family.repo_count), 0);

  const proposals = candidatesArtifact.families
    .map((family) => {
      const repoSignal = computeRepoSignal(family.repo_count, maxRepoCount);
      const portabilityScore = computePortabilityScore(repoSignal, family.mean_confidence);

      return {
        proposal_id: `proposal.${family.pattern_family}.generalization`,
        pattern_family: family.pattern_family,
        candidate_repos: [...family.repos].sort((left, right) => left.localeCompare(right)),
        mean_confidence: round4(family.mean_confidence),
        portability_score: portabilityScore,
        proposed_action: 'append_instance' as const,
        target_pattern: `pattern.${family.pattern_family}`,
        repo_count: family.repo_count
      };
    })
    .filter((proposal) => proposal.repo_count >= MIN_REPO_COUNT && proposal.portability_score >= MIN_PORTABILITY_SCORE)
    .sort(
      (left, right) =>
        right.portability_score - left.portability_score ||
        right.mean_confidence - left.mean_confidence ||
        left.pattern_family.localeCompare(right.pattern_family)
    )
    .map(({ repo_count: _repoCount, ...proposal }) => proposal);

  return {
    schemaVersion: '1.0',
    kind: 'pattern-proposals',
    generatedAt: candidatesArtifact.generatedAt,
    proposals
  };
};

export const generatePatternProposalArtifact = (cwd: string): PatternProposalArtifact => {
  const candidates = readCrossRepoCandidatesArtifact(cwd);
  return buildPatternProposalArtifact(candidates);
};

export const writePatternProposalArtifact = (cwd: string, artifact: PatternProposalArtifact): string => {
  const targetPath = path.join(cwd, PATTERN_PROPOSALS_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return targetPath;
};

export const readPatternProposalArtifact = (cwd: string): PatternProposalArtifact => {
  const targetPath = path.join(cwd, PATTERN_PROPOSALS_RELATIVE_PATH);
  if (!fs.existsSync(targetPath)) {
    throw new Error('playbook patterns proposals: missing artifact at .playbook/pattern-proposals.json.');
  }
  return readJson<PatternProposalArtifact>(targetPath);
};
