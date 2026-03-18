import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYBOOK_SCHEMA_PATHS } from '../../packages/contracts/src/index.js';

describe('workflow promotion contract', () => {
  it('registers the workflow promotion schema path', () => {
    expect(PLAYBOOK_SCHEMA_PATHS.workflowPromotion).toBe('packages/contracts/src/workflow-promotion.schema.json');
  });

  it('defines the normalized staged-promotion metadata shape', () => {
    const schemaPath = path.resolve(process.cwd(), PLAYBOOK_SCHEMA_PATHS.workflowPromotion);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as {
      required: string[];
      properties: Record<string, { const?: string; enum?: string[] }>;
    };

    expect(schema.required).toEqual([
      'schemaVersion',
      'kind',
      'workflow_kind',
      'staged_generation',
      'candidate_artifact_path',
      'staged_artifact_path',
      'committed_target_path',
      'validation_status',
      'validation_passed',
      'promotion_status',
      'promoted',
      'committed_state_preserved',
      'blocked_reason',
      'error_summary',
      'generated_at',
      'summary'
    ]);
    expect(schema.properties.kind?.const).toBe('workflow-promotion');
    expect(schema.properties.validation_status?.enum).toEqual(['passed', 'blocked']);
    expect(schema.properties.promotion_status?.enum).toEqual(['promoted', 'blocked']);
  });
});
