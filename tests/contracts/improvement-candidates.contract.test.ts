import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYBOOK_SCHEMA_PATHS } from '../../packages/contracts/src/index.js';

describe('improvement candidates contract', () => {
  it('registers improvement candidates schema path', () => {
    expect(PLAYBOOK_SCHEMA_PATHS.improvementCandidates).toBe('packages/contracts/src/improvement-candidates.schema.json');
  });

  it('declares allowed categories and thresholds', () => {
    const schemaPath = path.resolve(process.cwd(), 'packages/contracts/src/improvement-candidates.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as {
      properties?: {
        thresholds?: { properties?: { minimum_recurrence?: { const?: number }; minimum_confidence?: { const?: number } } };
        opportunity_analysis?: { properties?: { top_recommendation?: unknown; secondary_queue?: unknown } };
      };
      $defs?: {
        ImprovementCandidate?: { properties?: { category?: { enum?: string[] } } };
        ImprovementOpportunity?: { properties?: { heuristic_class?: { enum?: string[] } } };
      };
    };

    expect(schema.properties?.thresholds?.properties?.minimum_recurrence?.const).toBe(3);
    expect(schema.properties?.thresholds?.properties?.minimum_confidence?.const).toBe(0.6);
    expect(schema.$defs?.ImprovementCandidate?.properties?.category?.enum).toEqual([
      'routing',
      'orchestration',
      'worker_prompts',
      'validation_efficiency',
      'ontology'
    ]);
    expect(schema.properties?.opportunity_analysis?.properties?.top_recommendation).toBeDefined();
    expect(schema.properties?.opportunity_analysis?.properties?.secondary_queue).toBeDefined();
    expect(schema.$defs?.ImprovementOpportunity?.properties?.heuristic_class?.enum).toEqual([
      'duplicated_derivation_logic',
      'broad_query_fanout',
      'missing_invalidation_boundary',
      'repeated_recompute_loops',
      'canonical_id_inconsistency'
    ]);
  });
});
