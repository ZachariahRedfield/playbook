export const compactionCandidateArtifactSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'PlaybookCompactionCandidates',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'kind', 'candidates', 'summary'],
  properties: {
    schemaVersion: { const: '1.0' },
    kind: { const: 'playbook-compaction-candidates' },
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'schemaVersion',
          'kind',
          'candidateId',
          'sourceKind',
          'sourceRef',
          'subjectKind',
          'subjectRef',
          'trigger',
          'mechanism',
          'evidence',
          'related',
          'canonical'
        ]
      }
    },
    summary: { type: 'object' }
  }
} as const;
