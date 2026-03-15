import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYBOOK_SCHEMA_PATHS } from '../../packages/contracts/src/index.js';

describe('repository events contract', () => {
  it('registers repository events schema path', () => {
    expect(PLAYBOOK_SCHEMA_PATHS.repositoryEvents).toBe('packages/contracts/src/repository-events.schema.json');
  });

  it('declares v1 repository event types in schema', () => {
    const schemaPath = path.resolve(process.cwd(), 'packages/contracts/src/repository-events.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as {
      properties?: { event_type?: { enum?: string[] } };
    };

    expect(schema.properties?.event_type?.enum).toEqual([
      'route_decision',
      'lane_transition',
      'worker_assignment',
      'lane_outcome',
      'improvement_candidate'
    ]);
  });
});
