import type { RepositoryGraph } from '../graph/repoGraph.js';
import type { RepositoryIndex } from '../indexer/repoIndexer.js';
import { extractCompactionCandidates } from './extractCandidates.js';
import { COMPACTION_CANDIDATE_ARTIFACT_RELATIVE_PATH, buildCompactionCandidateArtifact, writeCompactionCandidateArtifact } from './writeCandidateArtifact.js';

export const generateCompactionCandidateArtifact = (input: { repoRoot: string; index?: RepositoryIndex; graph?: RepositoryGraph }) => {
  const candidates = extractCompactionCandidates(input);
  const artifact = buildCompactionCandidateArtifact(candidates);
  const artifactPath = writeCompactionCandidateArtifact(input.repoRoot, candidates);

  return {
    artifactPath,
    artifact,
    artifactRelativePath: COMPACTION_CANDIDATE_ARTIFACT_RELATIVE_PATH
  };
};

export { extractCompactionCandidates } from './extractCandidates.js';
export { canonicalizeCandidate } from './canonicalizeCandidate.js';
export { createCandidateFingerprint } from './candidateFingerprint.js';
export { compactionCandidateArtifactSchema } from './candidateSchema.js';
export type { CompactionCandidate, CompactionCandidateArtifact, CandidateSourceKind, CandidateSubjectKind } from './candidateTypes.js';

export { buildCompactionCandidateArtifact, writeCompactionCandidateArtifact, COMPACTION_CANDIDATE_ARTIFACT_RELATIVE_PATH } from './writeCandidateArtifact.js';
