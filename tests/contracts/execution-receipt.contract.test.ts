import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYBOOK_SCHEMA_PATHS } from '../../packages/contracts/src/index.js';

describe('execution receipt contract', () => {
  it('registers the execution receipt schema path', () => {
    expect(PLAYBOOK_SCHEMA_PATHS.executionReceipt).toBe('packages/contracts/src/execution-receipt.schema.json');
  });

  it('allows optional workflow-promotion metadata on receipts', () => {
    const schemaPath = path.resolve(process.cwd(), PLAYBOOK_SCHEMA_PATHS.executionReceipt);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as {
      properties: Record<string, { anyOf?: Array<Record<string, unknown>> }>;
    };

    expect(schema.properties.workflow_promotion?.anyOf).toEqual([
      { $ref: 'https://playbook.dev/schemas/workflow-promotion.schema.json' },
      { type: 'null' }
    ]);
  });
});
