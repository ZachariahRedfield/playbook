import fs from 'node:fs';
import path from 'node:path';
import type { BucketedCandidateEntry, CompactionBucketArtifact } from './bucketTypes.js';
import { COMPACTION_BUCKET_SCHEMA_VERSION } from './bucketTypes.js';

export const COMPACTION_BUCKET_ARTIFACT_RELATIVE_PATH = '.playbook/compaction/buckets.json' as const;

const byEntryOrder = (left: BucketedCandidateEntry, right: BucketedCandidateEntry): number =>
  left.bucket.localeCompare(right.bucket) || left.candidateId.localeCompare(right.candidateId) || left.candidateFingerprint.localeCompare(right.candidateFingerprint);

export const buildCompactionBucketArtifact = (entries: BucketedCandidateEntry[], inputCandidateCount: number): CompactionBucketArtifact => {
  const ordered = [...entries].sort(byEntryOrder);

  return {
    schemaVersion: COMPACTION_BUCKET_SCHEMA_VERSION,
    kind: 'playbook-compaction-buckets',
    generatedAt: 'deterministic',
    inputCandidateCount,
    summary: {
      discard: ordered.filter((entry) => entry.bucket === 'discard').length,
      attach: ordered.filter((entry) => entry.bucket === 'attach').length,
      merge: ordered.filter((entry) => entry.bucket === 'merge').length,
      add: ordered.filter((entry) => entry.bucket === 'add').length
    },
    entries: ordered
  };
};

export const writeCompactionBucketArtifact = (repoRoot: string, entries: BucketedCandidateEntry[], inputCandidateCount: number): string => {
  const artifactPath = path.join(repoRoot, COMPACTION_BUCKET_ARTIFACT_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(buildCompactionBucketArtifact(entries, inputCandidateCount), null, 2)}\n`, 'utf8');
  return artifactPath;
};
