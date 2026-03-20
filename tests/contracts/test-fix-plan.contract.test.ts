import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYBOOK_SCHEMA_PATHS } from '../../packages/contracts/src/index.js';

describe('test-fix-plan contract', () => {
  it('tracks the test-fix-plan schema path in the public contracts index', () => {
    expect(PLAYBOOK_SCHEMA_PATHS.testFixPlan).toBe('packages/contracts/src/test-fix-plan.schema.json');
  });

  it('publishes the governed task and exclusion shape', () => {
    const schemaPath = path.resolve(process.cwd(), PLAYBOOK_SCHEMA_PATHS.testFixPlan);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as Record<string, any>;
    expect(schema.properties.kind.const).toBe('test-fix-plan');
    expect(schema.properties.tasks.items.required).toEqual(['id', 'ruleId', 'file', 'action', 'autoFix', 'task_kind', 'provenance']);
    expect(schema.properties.excluded.items.properties.reason.enum).toEqual([
      'not_auto_fixable',
      'unsupported_failure_kind',
      'missing_target_file',
      'risky_or_review_required'
    ]);
  });
});
