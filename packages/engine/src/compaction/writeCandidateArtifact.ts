import fs from 'node:fs';
import path from 'node:path';
import type { CandidateSourceKind, CandidateSubjectKind, CompactionCandidate, CompactionCandidateArtifact } from './candidateTypes.js';

export const COMPACTION_CANDIDATE_ARTIFACT_RELATIVE_PATH = '.playbook/compaction/candidates.json' as const;

const SOURCE_KINDS: CandidateSourceKind[] = ['verify', 'plan', 'apply', 'analyze-pr', 'docs-audit'];
const SUBJECT_KINDS: CandidateSubjectKind[] = ['rule', 'task', 'module', 'docs', 'artifact', 'repository'];

export const buildCompactionCandidateArtifact = (candidates: CompactionCandidate[]): CompactionCandidateArtifact => {
  const bySourceKind = Object.fromEntries(SOURCE_KINDS.map((kind) => [kind, 0])) as Record<CandidateSourceKind, number>;
  const bySubjectKind = Object.fromEntries(SUBJECT_KINDS.map((kind) => [kind, 0])) as Record<CandidateSubjectKind, number>;

  for (const candidate of candidates) {
    bySourceKind[candidate.sourceKind] += 1;
    bySubjectKind[candidate.subjectKind] += 1;
  }

  return {
    schemaVersion: '1.0',
    kind: 'playbook-compaction-candidates',
    candidates,
    summary: {
      total: candidates.length,
      bySourceKind,
      bySubjectKind
    }
  };
};

export const writeCompactionCandidateArtifact = (repoRoot: string, candidates: CompactionCandidate[]): string => {
  const artifactPath = path.join(repoRoot, COMPACTION_CANDIDATE_ARTIFACT_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(buildCompactionCandidateArtifact(candidates), null, 2)}\n`, 'utf8');
  return artifactPath;
};
