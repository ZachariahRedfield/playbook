import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promoteMemoryCandidate, type MemoryPromotionResult } from '../memory/knowledge.js';
import type { MemoryReplayCandidate, MemoryReplayResult } from '../schema/memoryReplay.js';
import { createStoryRecord, createDefaultStoriesArtifact, readStoriesArtifact, upsertStory, validateStoriesArtifact, type StoriesArtifact, type StoryRecord } from '../story/stories.js';
import { type CrossRepoCandidatesArtifact, readCrossRepoCandidatesArtifact } from './crossRepoCandidateAggregation.js';

export const PATTERN_PROPOSALS_RELATIVE_PATH = '.playbook/pattern-proposals.json' as const;
const MEMORY_CANDIDATES_RELATIVE_PATH = '.playbook/memory/candidates.json' as const;
const MIN_REPO_COUNT = 2;

type PromotionTarget = {
  kind: 'memory' | 'story';
  command: string;
  target_artifact: string;
};

export type PatternProposalEvidence = {
  repo_id: string;
  artifact_kind: 'pattern-candidates';
  semantics: 'presence';
  why_portable: string;
};

export type PatternProposal = {
  proposal_id: string;
  pattern_family: string;
  candidate_repos: string[];
  mean_confidence: number;
  portability_score: number;
  proposed_action: 'append_instance';
  target_pattern: string;
  portability_rationale: string;
  evidence: PatternProposalEvidence[];
  promotion_targets: PromotionTarget[];
};

export type PatternProposalArtifact = {
  schemaVersion: '1.0';
  kind: 'pattern-proposals';
  generatedAt: string;
  proposals: PatternProposal[];
};

export type PatternProposalPromotionResult = {
  schemaVersion: '1.0';
  command: 'patterns.proposals.promote';
  target: 'memory' | 'story';
  proposal_id: string;
  proposal: PatternProposal;
  memory?: MemoryPromotionResult;
  story?: StoryRecord;
  artifactPath: string;
};

const readJson = <T>(targetPath: string): T => JSON.parse(fs.readFileSync(targetPath, 'utf8')) as T;
const round4 = (value: number): number => Number(value.toFixed(4));
const slugify = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'candidate';
const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const repoIdsFromSourceRefs = (sourceRefs: string[]): string[] => uniqueSorted(sourceRefs.map((entry) => entry.split('::')[0] ?? '').filter((entry) => entry.length > 0));

const computeRepoSignal = (repoCount: number, maxRepoCount: number): number => {
  if (maxRepoCount <= 0) return 0;
  return round4(repoCount / maxRepoCount);
};

const computePortabilityScore = (repoSignal: number): number => repoSignal;

const buildPortabilityRationale = (candidate: CrossRepoCandidatesArtifact['candidates'][number], repoIds: string[], portabilityScore: number): string =>
  `Portable across ${repoIds.length} repos with deterministic normalization key ${candidate.normalizationKey} and portability score ${portabilityScore}. Evidence remains additive source references, so promotion should stay explicit.`;

const buildEvidence = (repoIds: string[], portabilityRationale: string): PatternProposalEvidence[] =>
  repoIds.map((repoId) => ({
    repo_id: repoId,
    artifact_kind: 'pattern-candidates' as const,
    semantics: 'presence' as const,
    why_portable: portabilityRationale
  }));

export const buildPatternProposalArtifact = (candidatesArtifact: CrossRepoCandidatesArtifact): PatternProposalArtifact => {
  const maxRepoCount = candidatesArtifact.candidates.reduce((max, candidate) => Math.max(max, repoIdsFromSourceRefs(candidate.sourceRefs).length), 0);

  const proposals = candidatesArtifact.candidates
    .map((candidate) => {
      const repoIds = repoIdsFromSourceRefs(candidate.sourceRefs);
      const repoSignal = computeRepoSignal(repoIds.length, maxRepoCount);
      const portabilityScore = computePortabilityScore(repoSignal);
      const portabilityRationale = buildPortabilityRationale(candidate, repoIds, portabilityScore);
      const proposalSlug = slugify(candidate.normalizationKey);
      return {
        proposal_id: `proposal.${proposalSlug}.generalization`,
        pattern_family: candidate.normalizationKey,
        candidate_repos: repoIds,
        mean_confidence: portabilityScore,
        portability_score: portabilityScore,
        proposed_action: 'append_instance' as const,
        target_pattern: `pattern.${proposalSlug}`,
        evidence: buildEvidence(repoIds, portabilityRationale),
        portability_rationale: portabilityRationale,
        promotion_targets: [
          { kind: 'memory' as const, command: `pnpm playbook patterns proposals promote --proposal proposal.${proposalSlug}.generalization --target memory --json`, target_artifact: '.playbook/memory/knowledge/patterns.json' },
          { kind: 'story' as const, command: `pnpm playbook patterns proposals promote --proposal proposal.${proposalSlug}.generalization --target story --repo <repo-id> --json`, target_artifact: '.playbook/stories.json' }
        ],
        repo_count: repoIds.length
      };
    })
    .filter((proposal) => proposal.repo_count >= MIN_REPO_COUNT)
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

const ensureMemoryCandidatesArtifact = (cwd: string): MemoryReplayResult => {
  const targetPath = path.join(cwd, MEMORY_CANDIDATES_RELATIVE_PATH);
  if (!fs.existsSync(targetPath)) {
    return {
      schemaVersion: '1.0',
      command: 'memory-replay',
      sourceIndex: '.playbook/memory/index.json',
      generatedAt: new Date(0).toISOString(),
      totalEvents: 0,
      clustersEvaluated: 0,
      candidates: []
    };
  }
  return readJson<MemoryReplayResult>(targetPath);
};

const writeMemoryCandidatesArtifact = (cwd: string, artifact: MemoryReplayResult): string => {
  const targetPath = path.join(cwd, MEMORY_CANDIDATES_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return MEMORY_CANDIDATES_RELATIVE_PATH;
};

const toMemoryCandidate = (proposal: PatternProposal): MemoryReplayCandidate => ({
  candidateId: `cross-repo-${slugify(proposal.pattern_family)}`,
  kind: 'pattern',
  title: `Portable pattern: ${proposal.pattern_family}`,
  summary: proposal.portability_rationale,
  clusterKey: `cross-repo:${proposal.pattern_family}`,
  salienceScore: proposal.portability_score,
  salienceFactors: {
    severity: proposal.portability_score,
    recurrenceCount: proposal.candidate_repos.length,
    blastRadius: proposal.candidate_repos.length,
    crossModuleSpread: proposal.candidate_repos.length,
    ownershipDocsGap: 0,
    novelSuccessfulRemediationSignal: proposal.mean_confidence
  },
  fingerprint: crypto.createHash('sha256').update(`${proposal.proposal_id}:${proposal.portability_score}`).digest('hex'),
  module: 'cross-repo',
  ruleId: 'cross-repo-portability',
  failureShape: proposal.pattern_family,
  eventCount: proposal.evidence.length,
  provenance: proposal.evidence.map((entry, index) => ({
    eventId: `${proposal.proposal_id}:${index + 1}`,
    sourcePath: '.playbook/cross-repo-candidates.json',
    fingerprint: crypto.createHash('sha256').update(`${proposal.proposal_id}:${entry.repo_id}:${entry.artifact_kind}:${entry.semantics}`).digest('hex'),
    runId: null
  })),
  lastSeenAt: new Date().toISOString(),
  supersession: {
    evolutionOrdinal: 1,
    priorCandidateIds: [],
    supersedesCandidateIds: []
  }
});

const loadProposalById = (cwd: string, proposalId: string): PatternProposal => {
  const artifact = readPatternProposalArtifact(cwd);
  const proposal = artifact.proposals.find((entry) => entry.proposal_id === proposalId);
  if (!proposal) throw new Error(`playbook patterns proposals promote: proposal not found: ${proposalId}`);
  return proposal;
};

export const promotePatternProposalToMemory = (cwd: string, proposalId: string): PatternProposalPromotionResult => {
  const proposal = loadProposalById(cwd, proposalId);
  const current = ensureMemoryCandidatesArtifact(cwd);
  const candidate = toMemoryCandidate(proposal);
  const next: MemoryReplayResult = {
    ...current,
    generatedAt: new Date().toISOString(),
    candidates: [...current.candidates.filter((entry) => entry.candidateId !== candidate.candidateId), candidate].sort((left, right) => left.candidateId.localeCompare(right.candidateId))
  };
  writeMemoryCandidatesArtifact(cwd, next);
  const memory = promoteMemoryCandidate(cwd, candidate.candidateId);
  return {
    schemaVersion: '1.0',
    command: 'patterns.proposals.promote',
    target: 'memory',
    proposal_id: proposalId,
    proposal,
    memory,
    artifactPath: memory.artifactPath
  };
};

export const promotePatternProposalToStory = (cwd: string, proposalId: string, repoId: string): PatternProposalPromotionResult => {
  const proposal = loadProposalById(cwd, proposalId);
  if (!proposal.candidate_repos.includes(repoId)) {
    throw new Error(`playbook patterns proposals promote: repo ${repoId} is not part of proposal ${proposalId}`);
  }
  const repoName = path.basename(cwd);
  const current = fs.existsSync(path.join(cwd, '.playbook/stories.json')) ? readStoriesArtifact(cwd) : createDefaultStoriesArtifact(repoName);
  const story = createStoryRecord(current.repo, {
    id: `cross-repo-${slugify(proposal.pattern_family)}-${slugify(repoId)}`,
    title: `Adopt portable pattern \"${proposal.pattern_family}\" for ${repoId}`,
    type: 'feature',
    source: 'cross-repo-pattern-proposal',
    severity: proposal.portability_score >= 0.85 ? 'high' : 'medium',
    priority: proposal.portability_score >= 0.85 ? 'high' : 'medium',
    confidence: proposal.mean_confidence >= 0.8 ? 'high' : 'medium',
    rationale: `${proposal.portability_rationale} Promotion remains explicit so backlog adoption is human-reviewed for ${repoId}.`,
    evidence: uniqueSorted(['.playbook/cross-repo-candidates.json', '.playbook/pattern-proposals.json']),
    acceptance_criteria: uniqueSorted([
      `Review compared-repo evidence for ${proposal.pattern_family}.`,
      `Decide how ${repoId} should adopt or reject the portable pattern.`,
      'Keep evidence lineage linked from the cross-repo artifact into the backlog item.'
    ]),
    dependencies: [],
    execution_lane: 'safe_single_pr',
    suggested_route: 'pattern_learning'
  });
  const nextArtifact: StoriesArtifact = upsertStory(current, story);
  const errors = validateStoriesArtifact(nextArtifact);
  if (errors.length > 0) throw new Error(`playbook patterns proposals promote: invalid story artifact: ${errors.join('; ')}`);
  const targetPath = path.join(cwd, '.playbook/stories.json');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(nextArtifact, null, 2)}\n`, 'utf8');
  return {
    schemaVersion: '1.0',
    command: 'patterns.proposals.promote',
    target: 'story',
    proposal_id: proposalId,
    proposal,
    story,
    artifactPath: '.playbook/stories.json'
  };
};
