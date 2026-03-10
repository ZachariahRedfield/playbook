export const compactionBucketArtifactSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'PlaybookCompactionBuckets',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'kind', 'generatedAt', 'inputCandidateCount', 'summary', 'entries'],
  properties: {
    schemaVersion: { const: '1.0' },
    kind: { const: 'playbook-compaction-buckets' },
    generatedAt: { const: 'deterministic' },
    inputCandidateCount: { type: 'number' },
    summary: {
      type: 'object',
      required: ['discard', 'attach', 'merge', 'add'],
      properties: {
        discard: { type: 'number' },
        attach: { type: 'number' },
        merge: { type: 'number' },
        add: { type: 'number' }
      }
    },
    entries: {
      type: 'array',
      items: {
        type: 'object',
        required: ['candidateId', 'candidateFingerprint', 'bucket', 'reason', 'deferredGeneralizationCandidate', 'relation', 'importance', 'notes', 'candidate']
      }
    }
  }
} as const;
