import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYBOOK_SCHEMA_PATHS } from '../../packages/contracts/src/index.js';

describe('worker fragment contract', () => {
  it('registers the worker fragment schema path', () => {
    expect(PLAYBOOK_SCHEMA_PATHS.workerFragment).toBe('packages/contracts/src/worker-fragment.schema.json');
  });

  it('defines stable conflict and ordering keys for protected singleton doc fragments', () => {
    const schemaPath = path.resolve(process.cwd(), PLAYBOOK_SCHEMA_PATHS.workerFragment);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as {
      required: string[];
      properties: Record<string, { pattern?: string; const?: string }>;
    };

    expect(schema.required).toEqual(
      expect.arrayContaining(['target_doc', 'section_key', 'conflict_key', 'ordering_key', 'artifact_path'])
    );
    expect(schema.properties.kind).toEqual({ type: 'string', const: 'worker-fragment' });
    expect(schema.properties.conflict_key?.pattern).toBe('^[^\\s]+::[^\\s]+$');
    expect(schema.properties.ordering_key?.pattern).toBe('^[0-9]{4}:[^\\s]+::[^\\s]+::[^\\s]+$');
  });
});
